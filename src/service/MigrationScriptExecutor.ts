import _ from 'lodash';
import * as os from 'os'
import {
    BackupService,
    ConsoleRenderer,
    IBackupService,
    MigrationService,
    IMigrationService,
    MigrationScript,
    IDatabaseMigrationHandler,
    ISchemaVersionService,
    IScripts,
    SchemaVersionService,
    Utils
} from "../index";

export class MigrationScriptExecutor {

    backupService:IBackupService
    schemaVersionService: ISchemaVersionService
    consoleRenderer: ConsoleRenderer
    migrationService:IMigrationService

    constructor(private handler:IDatabaseMigrationHandler) {
        this.backupService = new BackupService(handler);
        this.schemaVersionService = new SchemaVersionService(handler.schemaVersion);
        this.consoleRenderer = new ConsoleRenderer(handler);
        this.migrationService = new MigrationService();

        this.consoleRenderer.drawFiglet();
    }

    public async migrate(): Promise<void> {
        let success = true;
        try {
            // inits
            await this.backupService.backup()
            await this.schemaVersionService.init(this.handler.cfg.tableName)

            // collects information about migrations
            const scripts = await Utils.promiseAll({
                migrated: this.schemaVersionService.getAllMigratedScripts(),
                all: this.migrationService.readMigrationScripts(this.handler.cfg)
            }) as IScripts;
            this.consoleRenderer.drawMigrated(scripts)

            // defines scripts which should be executed
            scripts.todo = this.getTodo(scripts.migrated, scripts.all);
            await Promise.all(scripts.todo.map(s => s.init()))

            if (!scripts.todo.length) {
                console.info('Nothing to do');
                this.exit(true)
            }

            console.info('Processing...');
            this.consoleRenderer.drawTodoTable(scripts.todo);
            scripts.executed = await this.execute(scripts.todo);
            this.consoleRenderer.drawExecutedTable(scripts.executed);
            console.info('Migration finished successfully!');
            this.backupService.deleteBackup();
        } catch (err) {
            console.error(err)
            success = false
            await this.backupService.restore();
            this.backupService.deleteBackup();
        }
        this.exit(success)
    }

    public async list(number = 0) {
        const scripts = await Utils.promiseAll({
            migrated: this.schemaVersionService.getAllMigratedScripts(),
            all: this.migrationService.readMigrationScripts(this.handler.cfg)
        }) as IScripts;


        if(number) {
            scripts.migrated = _
                .chain(scripts.migrated)
                .orderBy(['timestamp'], ['desc'])
                .splice(0, number)
                .value()
        }

        this.consoleRenderer.drawMigrated(scripts)
    }

    exit(success:boolean):void {
        process.exit(success ? 0 : 1);
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
        const username:string = os.userInfo().username;

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

    async task(script:MigrationScript) {
        console.log(`${script.name}: processing...`);

        script.startedAt = Date.now()
        script.result = await script.script.up(this.handler.db, script, this.handler);
        script.finishedAt = Date.now();

        await this.schemaVersionService.save(script);
        return script
    }
}