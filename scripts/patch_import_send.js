const fs = require('fs');
let code = fs.readFileSync('app/customer-interface/page.js', 'utf8');

code = code.replace(
  /import \{ RefreshCw, Printer, Lock, Maximize, Bot, Mic, History, Shirt, Crown, Star, Sparkles, Scissors, Gem, Heart, ShoppingBag, Feather, Palette, Camera, Tag, Gift, Sun, Moon, Music, Smile, Search, Calendar, Loader2, LogOut, Plus \}/,
  'import { RefreshCw, Printer, Lock, Maximize, Bot, Mic, History, Shirt, Crown, Star, Sparkles, Scissors, Gem, Heart, ShoppingBag, Feather, Palette, Camera, Tag, Gift, Sun, Moon, Music, Smile, Search, Calendar, Loader2, LogOut, Plus, Send }'
);

fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
console.log('Added Send to lucide imports');
