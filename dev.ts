import {Config, IDB, IRunner, MigrationScript, MSRunner, IMigrationInfo} from "./src";

// ----
// This an example of usage added for development purpose
// ----

const cfg = new Config();
cfg.folder = `${process.cwd()}/migrations`;
cfg.backup.folder = `${process.cwd()}/backups`;

const runner: IRunner = {
    cfg: cfg,
    db: new class A implements IDB {
        dummyMethod():string {
            throw new Error("Not implemented");
        }
    },

    createTable(tableName: string): Promise<any> {
        return Promise.resolve(true);
    },
    getAll(): Promise<MigrationScript[]> {
        return Promise.resolve([]);
    },
    isInitialized(tableName: string): Promise<any> {
        return Promise.resolve(undefined);
    },
    register(details: IMigrationInfo): Promise<any> {
        return Promise.resolve(undefined);
    },
    validateTable(tableName: string): Promise<any> {
        return Promise.resolve(true);
    },
    restore(data: string): Promise<any> {
        return Promise.resolve("undefined");
    },
    backup(): Promise<string> {
        return Promise.resolve("test");
    },
    getName(): string {
        return "Firebase"
    }
}

new MSRunner(runner).migrate()