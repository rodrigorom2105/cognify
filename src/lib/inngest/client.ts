import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'cognify-app',
  name: 'Cognify App',
});

export type InngestEvents = {
  'document.uploaded': {
    data: {
      documentId: string;
      userId: string;
      storagePath: string;
      filename: string;
    };
  };
  'document.processed': {
    data: {
      documentId: string;
      userId: string;
      chunkCount: number;
      pageCount: number;
    };
  };
  'document.failed': {
    data: {
      documentId: string;
      userId: string;
      error: string;
    };
  };
};
