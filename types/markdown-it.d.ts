declare module 'markdown-it' {
  interface MarkdownIt {
    inline: {
      ruler: {
        before(
          beforeName: string,
          ruleName: string,
          fn: (state: any, silent: boolean) => boolean,
        ): void;
      };
    };
  }
  interface MarkdownItConstructor {
    new (options?: {
      html?: boolean;
      linkify?: boolean;
      breaks?: boolean;
      typographer?: boolean;
    }): MarkdownIt;
    (options?: {
      html?: boolean;
      linkify?: boolean;
      breaks?: boolean;
      typographer?: boolean;
    }): MarkdownIt;
  }
  const MarkdownIt: MarkdownItConstructor;
  export default MarkdownIt;
}
