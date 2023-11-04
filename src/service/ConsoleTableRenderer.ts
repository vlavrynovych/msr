import {Config, MigrationInfo, MigrationScriptInfo} from "../model";
import {AsciiTable3, AlignmentEnum} from 'ascii-table3';
import moment from "moment";

export class ConsoleTableRenderer {
    constructor(private cfg: Config) {}

    public drawMigrated(alreadyMigrated: MigrationScriptInfo[], allScripts:MigrationScriptInfo[]) {
        if (alreadyMigrated.length) {
            let table = new AsciiTable3('Migrated');
            table.setHeading('Timestamp', 'Name', 'Executed', 'Username', 'Found Locally');
            table.setAlign(4, AlignmentEnum.CENTER);
            alreadyMigrated.forEach(m => {
                const finished = moment(m.finishedAt);
                let date = finished.format('YYYY/MM/DD HH:mm');
                let ago = finished.fromNow();
                let name = m.name.replace(this.cfg.filePattern, '');
                let found = allScripts.find(s => s.timestamp === m.timestamp) ? 'Y' : 'N';
                table.addRow(m.timestamp, name, `${date} (${ago})`, m.username, found)
            });
            console.log(table.toString());
        }
    }

    public drawTodoTable(scripts:MigrationScriptInfo[]) {
        let table = new AsciiTable3('TODO');
        table.setHeading('Timestamp', 'Name');
        scripts.forEach(m => table.addRow(m.timestamp, m.name));
        console.log(table.toString());
    }

    public drawExecutedTable(results: MigrationInfo[]) {
        let table = new AsciiTable3('Executed');
        table.setHeading('Timestamp', 'Name', 'Duration', 'Result');
        results.forEach(m => {
            let duration = moment.duration(moment(m.finishedAt).diff(moment(m.startedAt)));
            table.addRow(m.timestamp, m.name, duration.asSeconds() + 's', m.result)
        });
        console.log(table.toString());
    }

}