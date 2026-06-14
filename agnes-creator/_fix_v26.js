const fs = require("fs");
const base = "E:\\codex-project-source\\agnes-ai-studio\\agnes-creator";
let path = base + "\\src\\app\\pipeline\\page.tsx";
let text = fs.readFileSync(path, "utf-8");

// Fix the scene number display
const oldDisplay = '<span className="font-medium text-foreground w-20 shrink-0 text-[10px]">Sc${String(item.sceneOrder).padStart(2, "0")}-Sh${String(item.shotOrder).padStart(2, "0")}</span>';
const newDisplay = '<span className="font-medium text-foreground w-20 shrink-0 text-[10px]">{\`Sc\${String(item.sceneOrder).padStart(2, "0")}-Sh\${String(item.shotOrder).padStart(2, "0")}\`}</span>';
text = text.replace(oldDisplay, newDisplay);

// Also add ImageIcon import if not there
text = text.replace(
  'Share2, Eye, EyeOff, Lock, Trash2,',
  'Share2, Eye, EyeOff, Lock, Trash2, ImageIcon,'
);

fs.writeFileSync(path, text, "utf-8");
console.log("Pipeline page display & import fixed");
