const fs = require('fs');
let code = fs.readFileSync('app/customer-interface/page.js', 'utf8');

const loaderRegex = /\{aiLoading && <div style=\{\{ display: 'flex'[^>]+>.*?<\/div> <span>מקליד\.\.\.<\/span><\/div>\}/g;

const newLoader = `{aiLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1rem', alignSelf: 'flex-start', background: 'white', padding: '16px 20px', borderRadius: '20px 20px 20px 4px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
                    <div className="typing-dot" style={{ animationDelay: '0s' }}></div>
                    <div className="typing-dot" style={{ animationDelay: '0.2s' }}></div>
                    <div className="typing-dot" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                )}`;

if (loaderRegex.test(code)) {
    code = code.replace(loaderRegex, newLoader);
    
    // Now add the typing-dot CSS to one of the style blocks
    if (!code.includes('.typing-dot {')) {
        const cssToAdd = `
        .typing-dot {
          width: 8px;
          height: 8px;
          background-color: #a855f7;
          border-radius: 50%;
          animation: typing-bounce 1.4s infinite ease-in-out both;
        }
        @keyframes typing-bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
        `;
        
        // Find the main style block
        code = code.replace(/<style dangerouslySetInnerHTML=\{\{__html: `/g, `<style dangerouslySetInnerHTML={{__html: \`${cssToAdd}`);
    }
    
    fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
    console.log('Typing indicator patched successfully');
} else {
    console.log('Loader regex failed');
}
