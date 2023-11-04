import {IDAO} from "./IDAO";

export interface IMigrationScript {
    up(dao:IDAO, info:any):Promise<string>;
}