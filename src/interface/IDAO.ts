
export interface IDAO {
    getName(): string;
    backup(): Promise<string>
    restore(data: string): Promise<any>;
}