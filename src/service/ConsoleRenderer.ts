import moment from "moment";
import figlet from "figlet";
import {AsciiTable3, AlignmentEnum} from 'ascii-table3';
import {version} from '../../package.json'

import {IMigrationInfo, IDatabaseMigrationHandler, IScripts, MigrationScript} from "../index";

export class ConsoleRenderer {
    constructor(private handler: IDatabaseMigrationHandler) {}

    public drawFiglet() {
        let text = figlet.textSync("Migration Script Runner");
        text = text.replace('|_|                                     ',
            `|_| MSR v.${version}: ${this.handler.getName()}`);
        console.log(text);
    }

    public drawMigrated(scripts:IScripts) {
        if (!scripts.migrated.length) return

        const table = new AsciiTable3('Migrated');
        table.setHeading('Timestamp', 'Name', 'Executed', 'Duration', 'Username', 'Found Locally');
        table.setAlign(4, AlignmentEnum.CENTER);
        scripts.migrated.forEach(m => {
            const finished = moment(m.finishedAt);
            const date = finished.format('YYYY/MM/DD HH:mm');
            const ago = finished.fromNow();
            const name = m.name.replace(this.handler.cfg.filePattern, '');
            const found = (scripts.all || []).find(s => s.timestamp === m.timestamp) ? 'Y' : 'N';
            table.addRow(m.timestamp, name, `${date} (${ago})`, ConsoleRenderer.getDuration(m), m.username, found)
        });
        console.log(table.toString());
    }

    public drawTodoTable(scripts:MigrationScript[]) {
        if(!scripts.length) return;

        const table = new AsciiTable3('TODO');
        table.setHeading('Timestamp', 'Name', 'Path');
        scripts.forEach(m => table.addRow(m.timestamp, m.name, m.filepath));
        console.log(table.toString());
    }

    public drawIgnoredTable(scripts:MigrationScript[]) {
        if(!scripts.length) return;

        const table = new AsciiTable3('Ignored Scripts');
        table.setHeading('Timestamp', 'Name', 'Path');
        scripts.forEach(m => table.addRow(m.timestamp, m.name, m.filepath));
        console.warn(table.toString());
    }

    public drawExecutedTable(scripts: IMigrationInfo[]) {
        if(!scripts.length) return;

        const table = new AsciiTable3('Executed');
        table.setHeading('Timestamp', 'Name', 'Duration', 'Result');
        scripts.forEach(m => table.addRow(m.timestamp, m.name, ConsoleRenderer.getDuration(m), m.result));
        console.log(table.toString());
    }

    public static getDuration(m:IMigrationInfo) {
        const duration = moment.duration(moment(m.finishedAt).diff(moment(m.startedAt))).asSeconds()
        return `${duration}s`
    }

}