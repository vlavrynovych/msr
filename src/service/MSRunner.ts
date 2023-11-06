import * as _ from 'lodash'
import {
    BackupService,
    ConsoleRenderer,
    IBackupService,
    MigrationService,
    IMigrationService,
    MigrationScript,
    IRunner,
    ISchemaVersionService,
    IScripts,
    SchemaVersionService,
    Utils
} from "../index";

export class MSRunner {

    backupService:IBackupService
    schemaVersionService: ISchemaVersionService
    consoleRenderer: ConsoleRenderer
    migrationService:IMigrationService

    constructor(private runner:IRunner) {
        this.backupService = new BackupService(runner);
        this.schemaVersionService = new SchemaVersionService(runner);
        this.consoleRenderer = new ConsoleRenderer(runner);
        this.migrationService = new MigrationService(runner.cfg);

        this.consoleRenderer.drawFiglet();
    }

    public async migrate(): Promise<any> {
        try {
            // inits
            await this.backupService.backup()
            await this.schemaVersionService.init(this.runner.cfg.tableName)

            // collects information about migrations
            const scripts = await Utils.promiseAll({
                migrated: this.schemaVersionService.getAllMigratedScripts(),
                all: this.migrationService.readMigrationScripts()
            }) as IScripts;
            this.consoleRenderer.drawMigrated(scripts)

            // defines scripts which should be executed
            scripts.todo = this.getTodo(scripts.migrated, scripts.all);
            scripts.todo.forEach(s => s.init())
            if (!scripts.todo.length) {
                console.info('Nothing to do');
                process.exit(0);
            }

            console.info('Validating...');
            await this.migrationService.validate(scripts.todo);

            console.info('Processing...');
            this.consoleRenderer.drawTodoTable(scripts.todo);
            scripts.executed = await this.execute(scripts.todo);
            this.consoleRenderer.drawExecutedTable(scripts.executed);

            console.info('Migration finished successfully!');
            this.backupService.deleteBackup();
            process.exit(0)
        } catch (err) {
            console.error(err);
            await this.backupService.restore();
            process.exit(1);
        }
    }

    getTodo(migrated:MigrationScript[], all:MigrationScript[]) {
        if(!migrated.length) return all;
        const lastMigrated:number = Math.max(...migrated.map(s => s.timestamp))

        const newScripts:MigrationScript[] = _.differenceBy(all, migrated, 'timestamp')
        const todo:MigrationScript[] = newScripts.filter(s => s.timestamp > lastMigrated)
        const ignored:MigrationScript[] = _.differenceBy(newScripts, todo, 'timestamp')
        this.consoleRenderer.drawIgnoredTable(ignored);

        return todo;
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
}