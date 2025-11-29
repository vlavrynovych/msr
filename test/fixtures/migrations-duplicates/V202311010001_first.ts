import {IMigration} from "../../../src/interface";

export const migration: IMigration = {
    up: async () => {
        return "First migration with duplicate timestamp";
    }
}
