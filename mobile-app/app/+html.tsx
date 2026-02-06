import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
                <ScrollViewStyleReset />
                <style dangerouslySetInnerHTML={{
                    __html: `
          /* Ensure the root element fills the height */
          html, body, #root {
            height: 100%;
          }
          /* Allow browser-level scrolling */
          body {
            overflow: auto !important; 
          }
        `}} />
            </head>
            <body>{children}</body>
        </html>
    );
}
