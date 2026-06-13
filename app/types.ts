export interface Tender {
    id: string;
    title: string;
    publisher: string;
    category: string;
    region: string;
    deadline: string | null;
    budget: number | null;
    description: string;
    url: string;
    publishDate: string;
    status: string;
}
