// Otomatik üretilir: npm run i18n:index. Sözlük parçaları src/i18n/en/*.json içindedir.
import p0 from "./en/_core.json";
import p1 from "./en/app.json";
import p2 from "./en/room.json";
import p3 from "./en/rules.json";
import p4 from "./en/server.json";
import p5 from "./en/shz-sheet.json";
import p6 from "./en/uc-sheet.json";
import p7 from "./en/wizards.json";

export const EN: Record<string, string> = Object.assign({}, p0, p1, p2, p3, p4, p5, p6, p7);
