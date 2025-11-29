import {IMigration} from "../../../src/interface";

export const migration: IMigration = {
    up: async () => {
        return "Second migration with duplicate timestamp";
    }
}
