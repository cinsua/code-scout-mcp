import { tool } from '@opencode-ai/plugin';

export default tool({
  description:
    'query from 1 to 5 tags or keywords to search into the code base and get a proper summary of files/classes/functions/symbols',
  args: {
    // here we should allow a list of 1 to 5 strings like 'user' 'page' 'dataBase' 'authLogin' 'react'
    query: tool.schema
      .array(tool.schema.string())
      .min(1)
      .max(5)
      .describe('List of tags or keywords to search in the codebase'),
  },
  async execute(args) {
    // we should get this request with args, not touch this: &limit=20&compact=false&format=md
    // seems that should be comma separed and comma equals to %2C%20
    // http://localhost:8000/api/query?tags=database%2C%20sqlite&limit=20&compact=false&format=md
    const tags = args.query.join(', ');
    const encodedTags = encodeURIComponent(tags);
    const url = `http://localhost:8000/api/query?tags=${encodedTags}&limit=20&compact=false&format=md`;
    const response = await fetch(url);
    const result = await response.text();
    return result;
  },
});
