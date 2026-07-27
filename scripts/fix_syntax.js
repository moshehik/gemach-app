const fs = require('fs');
let code = fs.readFileSync('app/customer-interface/page.js', 'utf8');

const errorRegex = /<\/form>\s*<\/div>\s*<\/div>\s*<div className="glass-panel"/;
if (errorRegex.test(code)) {
    code = code.replace(errorRegex, '</form>\n            </div>\n          )}\n          </div>\n\n          <div className="glass-panel"');
    fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
    console.log('Fixed syntax error');
} else {
    console.log('Error regex did not match. Trying another approach.');
    
    // Let's just find exactly:
    /*
                  {aiLoading ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24} />}
                </button>
              </form>

              
            </div>
          </div>
    */
    const fallbackRegex = /<Sparkles size=\{24\} \/>\}\s*<\/button>\s*<\/form>\s*<\/div>\s*<\/div>/;
    if (fallbackRegex.test(code)) {
        code = code.replace(fallbackRegex, '<Sparkles size={24} />}\n                </button>\n              </form>\n            </div>\n          )}\n          </div>');
        fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
        console.log('Fixed using fallback');
    } else {
        console.log('Fallback failed');
    }
}
