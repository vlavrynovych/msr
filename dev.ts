import {Config, IDAO, MSRunner} from "./index";

// ----
// This an example of usage added for development purpose
// ----

const dao: IDAO = {
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

const cfg = new Config(dao);
cfg.folders.migrations = `${process.cwd()}/migrations`;
cfg.folders.backups = `${process.cwd()}/backups`;

new MSRunner(cfg).migrate()