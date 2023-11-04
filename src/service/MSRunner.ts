import * as fs from 'fs';
import * as _ from 'lodash'
import {version} from '../../package.json'
import {BackupService, Config, MigrationInfo, MigrationScriptInfo} from "../index";
import figlet from "figlet";
import {ConsoleTableRenderer} from "./ConsoleTableRenderer";

export class MSRunner {

    private backupService:BackupService;
    tr: ConsoleTableRenderer;

    constructor(private cfg:Config) {
        this.backupService = new BackupService(cfg);
        this.tr = new ConsoleTableRenderer(cfg);
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

                this.tr.drawMigrated(migratedScripts, allScripts)
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
            this.tr.drawTodoTable(scripts);
            console.info('Processing...');
            _.orderBy(scripts, ['timestamp'], ['desc']);
            return this.execute(scripts);
        } else {
            console.info('Nothing to do');
            process.exit(0);
        }
    }

    async execute(scripts: MigrationScriptInfo[]): Promise<any> {
        let results: MigrationInfo[] = [];
        let username = require("os").userInfo().username;

        // let tasks = scripts.map(script => () => {
        await scripts
            .map(script=>
                async () => {
                    results.push(await this.task(script, username))
                }
            )
            .reduce((p, task) => p.then(() => task()), Promise.resolve());
        this.tr.drawExecutedTable(results);
    }

    private async task(script:MigrationScriptInfo, username:string) {
        console.log(`${script.name}: processing...`);

        let details = {
            name: script.name,
            timestamp: script.timestamp,
            startedAt: Date.now(),
            username: username,
        } as MigrationInfo;

        details.result = await script.script.up(this.cfg.dao, details);
        details.finishedAt = Date.now();
        await this.log(details);
        return details
    }

    log(details: MigrationInfo):Promise<any> {
        return Promise.resolve()
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