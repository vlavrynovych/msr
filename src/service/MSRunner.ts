import * as fs from 'fs';
import * as _ from 'lodash'
import {BackupService, ConsoleRenderer, IRunner, MigrationScript, SchemaVersionService} from "../index";

export class MSRunner {

    private backupService:BackupService;
    private consoleRenderer: ConsoleRenderer;
    private schemaVersionService: SchemaVersionService;

    constructor(private runner:IRunner) {
        this.backupService = new BackupService(runner);
        this.schemaVersionService = new SchemaVersionService(runner);
        this.consoleRenderer = new ConsoleRenderer(runner);

        this.consoleRenderer.drawFiglet();
    }

    public async migrate(): Promise<any> {
        try {
            await this.backupService.backup()
            await this.schemaVersionService.init()
            const res:[MigrationScript[], MigrationScript[]] = await Promise.all([
                this.schemaVersionService.getAllMigratedScripts(),
                this.getMigrationScripts(),
            ])
            const migratedScripts: MigrationScript[] = res[0];
            const allScripts: MigrationScript[] = res[1];

            this.consoleRenderer.drawMigrated(migratedScripts, allScripts)
            const scripts:MigrationScript[] = _.differenceBy(allScripts, migratedScripts, 'timestamp')


            if (!scripts.length) {
                console.info('Nothing to do');
                process.exit(0);
            }

            this.consoleRenderer.drawTodoTable(scripts);
            console.info('Processing...');
            const executed:MigrationScript[] = await this.execute(scripts);
            this.consoleRenderer.drawExecutedTable(executed);

            console.info('Migration finished successfully!');
            this.backupService.deleteBackup();
            process.exit(0)
        } catch (err) {
            console.error(err);
            await this.backupService.restore();
            process.exit(1);
        }
    }

    async execute(scripts: MigrationScript[]): Promise<MigrationScript[]> {
        scripts = _.orderBy(scripts, ['timestamp'], ['asc'])
        const executed: MigrationScript[] = [];
        const username = require("os").userInfo().username;

        // prepares queue of migration tasks
        const tasks = _.orderBy(scripts, ['timestamp'], ['asc'])
            .map((s: MigrationScript) => {
                s.username = username;
                return async () => {
                    executed.push(await this.task(s))
                }
            });

        // runs migrations
        await tasks.reduce(async (promise, nextTask) => {
                await promise
                return nextTask()
            }, Promise.resolve());

        return executed;
    }

    private async task(script:MigrationScript) {
        console.log(`${script.name}: processing...`);

        script.startedAt = Date.now()
        script.result = await script.script.up(this.runner.db, script, this.runner);
        script.finishedAt = Date.now();

        await this.schemaVersionService.register(script);
        return script
    }

    private async getMigrationScripts(): Promise<MigrationScript[]> {
        const files:string[] = fs.readdirSync(this.runner.cfg.folder);
        return files
            .filter(name => this.runner.cfg.filePattern.test(name))
            .map(name => {
                const execArray: RegExpExecArray | null = this.runner.cfg.filePattern.exec(name);
                if(execArray == null) throw new Error("Wrong file name format")
                const timestamp = parseInt(execArray[1]);
                return new MigrationScript(name, `${this.runner.cfg.folder}/${name}`, timestamp);
            })
    }
}