import * as fs from 'fs';
import * as _ from 'lodash'
import {version} from '../../package.json'
import {MigrationScriptInfo, Config, BackupService, MigrationInfo} from "../index";
import figlet from "figlet";

export class MSRunner {

    private backupService:BackupService;

    constructor(private cfg:Config) {
        this.backupService = new BackupService(cfg);
        this.drawFiglet();
    }

    private drawFiglet() {
        let text = figlet.textSync("Migration Script Runner");
        text = text.replace('|_|                                     ',
            `|_| MSR v.${version}: ${this.cfg.dao.getName()}`);
        console.log(text);
    }

    public async migrate(): Promise<any> {
        await Promise.all([
            this.backupService.backup(),
            this.getMigratedScripts(),
            this.getMigrationScripts(),
        ])
            .then(res => {
                const migratedScripts:MigrationScriptInfo[] = res[1];
                const allScripts:MigrationScriptInfo[] = res[2];

                this.drawMigrated(migratedScripts)
                return this.findDifference(migratedScripts, allScripts)
            })
            .then(scripts => this.runScripts(scripts))
            .then(() => {
                console.info('Migration finished successfully!');
                this.backupService.deleteBackup();
                process.exit(0);
            })
            .catch(err => {
                console.error(err);
                return this.backupService.restore();
            })

    }

    private runScripts(scripts:MigrationScriptInfo[]) {
        if (scripts.length) {
            this.drawTodoTable(scripts);
            console.info('Processing...');
            _.orderBy(scripts, ['timestamp'], ['desc']);
            return this.execute(scripts);
        } else {
            console.info('Nothing to do');
            process.exit(0);
        }
    }

    async execute(scripts: MigrationScriptInfo[]): Promise<any> {
        let results: any[] = [];
        let username = require("os").userInfo().username;

        let tasks = scripts.map(script => () => {
            console.log(`${script.name}: processing...`);
            console.time(script.name);

            let details = {
                name: script.name,
                timestamp: script.timestamp,
                startedAt: Date.now(),
                username: username,
            } as MigrationInfo;

            return script.script && script.script.up(this.cfg.dao, details)

            // return script.instance.up(this.db, details)
                .then(async result => {
                    details.result = result;
                    details.finishedAt = Date.now();
                    await this.log(details)
                    results.push(details);
                })
        });

        // execute
        await tasks.reduce((p, task) => p.then(() => task()), Promise.resolve());
        this.drawExecutedTable(results);
    }

    log(details: MigrationInfo):Promise<any> {
        return Promise.resolve()
    }

    drawExecutedTable(results: any[]) {
        // let table = new AsciiTable('Executed');
        // table.setHeading('Timestamp', 'Name', 'Duration');
        // results.forEach(m => {
        //     let duration = moment.duration(moment(m.finishedAt).diff(moment(m.startedAt)));
        //     table.addRow(m.timestamp, m.name, duration.asSeconds() + 's')
        // });
        // console.info(table.toString());

        results.forEach(m => console.log(m));
    }

    drawTodoTable(scripts:MigrationScriptInfo[]) {
        scripts.forEach(s => console.log(s))
    }

    private drawMigrated(alreadyMigrated: MigrationScriptInfo[]) {
        alreadyMigrated.forEach(script => console.log(script.name))
    }

    private async getMigrationScripts(): Promise<MigrationScriptInfo[]> {
        let files:string[] = fs.readdirSync(this.cfg.folders.migrations);
        return files
            .filter(name => this.cfg.filePattern.test(name))
            .map(name => {
                const execArray: RegExpExecArray | null = this.cfg.filePattern.exec(name);
                const timestamp = execArray && parseInt(execArray[1]);
                return new MigrationScriptInfo(name, `${this.cfg.folders.migrations}/${name}`, timestamp);
            })
    }

    private getMigratedScripts(): Promise<MigrationScriptInfo[]> {
        return Promise.resolve([]);
    }

    public findDifference(migratedScripts:MigrationScriptInfo[], allScripts:MigrationScriptInfo[]): any {
        return _.differenceBy(allScripts, migratedScripts, 'timestamp');
    }
}