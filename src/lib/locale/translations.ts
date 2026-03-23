export type Locale = "tr" | "en";

export const translations = {
  // ─── Common ────────────────────────────────────────────
  "common.save": { tr: "Kaydet", en: "Save" },
  "common.cancel": { tr: "Iptal", en: "Cancel" },
  "common.delete": { tr: "Sil", en: "Delete" },
  "common.edit": { tr: "Duzenle", en: "Edit" },
  "common.create": { tr: "Olustur", en: "Create" },
  "common.close": { tr: "Kapat", en: "Close" },
  "common.back": { tr: "Geri", en: "Back" },
  "common.loading": { tr: "Yukleniyor...", en: "Loading..." },
  "common.saving": { tr: "Kaydediliyor...", en: "Saving..." },
  "common.saved": { tr: "Kaydedildi", en: "Saved" },
  "common.error": { tr: "Bir hata olustu.", en: "An error occurred." },
  "common.confirm": { tr: "Onayla", en: "Confirm" },
  "common.areYouSure": { tr: "Emin misiniz?", en: "Are you sure?" },
  "common.giveUp": { tr: "Vazgec", en: "Cancel" },
  "common.send": { tr: "Gonder", en: "Send" },
  "common.join": { tr: "Katil", en: "Join" },
  "common.remove": { tr: "Kaldir", en: "Remove" },
  "common.approve": { tr: "Onayla", en: "Approve" },
  "common.reject": { tr: "Reddet", en: "Reject" },
  "common.tryAgain": { tr: "Tekrar Dene", en: "Try Again" },
  "common.add": { tr: "Ekle", en: "Add" },
  "common.name": { tr: "Ad", en: "Name" },
  "common.description": { tr: "Aciklama", en: "Description" },
  "common.level": { tr: "Seviye", en: "Level" },
  "common.yours": { tr: "Senin", en: "Yours" },
  "common.private": { tr: "Gizli", en: "Private" },
  "common.untitled": { tr: "Basliksiz", en: "Untitled" },
  "common.errorOccurred": { tr: "Hata olustu", en: "Error occurred" },
  "common.players": { tr: "Oyuncular", en: "Players" },
  "common.player": { tr: "oyuncu", en: "player" },
  "common.noPermission": { tr: "Yetkiniz yok.", en: "No permission." },
  "common.notFound": { tr: "Bulunamadi.", en: "Not found." },

  // ─── Auth ──────────────────────────────────────────────
  "auth.login": { tr: "Giris Yap", en: "Sign In" },
  "auth.register": { tr: "Kayit Ol", en: "Sign Up" },
  "auth.logout": { tr: "Cikis Yap", en: "Sign Out" },
  "auth.email": { tr: "Email", en: "Email" },
  "auth.password": { tr: "Sifre (min 6 karakter)", en: "Password (min 6 characters)" },
  "auth.username": { tr: "Kullanici Adi", en: "Username" },
  "auth.loginError": { tr: "Email veya sifre hatali.", en: "Invalid email or password." },
  "auth.loggingIn": { tr: "Giris yapiliyor...", en: "Signing in..." },
  "auth.registering": { tr: "Kaydediliyor...", en: "Registering..." },
  "auth.noAccount": { tr: "Hesabin yok mu?", en: "Don't have an account?" },
  "auth.hasAccount": { tr: "Zaten hesabin var mi?", en: "Already have an account?" },

  // ─── Dashboard ─────────────────────────────────────────
  "dashboard.title": { tr: "Dashboard", en: "Dashboard" },
  "dashboard.welcome": { tr: "Hos geldin,", en: "Welcome," },

  // ─── GM Panel ──────────────────────────────────────────
  "gm.panel": { tr: "GM Paneli", en: "GM Panel" },
  "gm.newGameset": { tr: "Yeni Gameset", en: "New Gameset" },
  "gm.newRoom": { tr: "Yeni Oda", en: "New Room" },
  "gm.gamesetName": { tr: "Gameset adi", en: "Gameset name" },
  "gm.yourGamesets": { tr: "Gameset'lerin", en: "Your Gamesets" },
  "gm.deleteGameset": { tr: "Gameset Sil", en: "Delete Gameset" },
  "gm.deleteGamesetWarning": {
    tr: "Bu islem geri alinamaz. Gameset'e bagli tum kapatilmis odalar, karakterler ve veriler kalici olarak silinecektir. Onaylamak icin gameset adini yazin:",
    en: "This action cannot be undone. All closed rooms, characters, and data associated with this gameset will be permanently deleted. Type the gameset name to confirm:",
  },
  "gm.deleting": { tr: "Siliniyor...", en: "Deleting..." },
  "gm.deletePermanently": { tr: "Kalici Olarak Sil", en: "Delete Permanently" },
  "gm.deleteFailed": { tr: "Silinemedi.", en: "Delete failed." },
  "gm.roomName": { tr: "Oda adi", en: "Room name" },
  "gm.createGamesetFirst": { tr: "Once bir gameset olusturun.", en: "Create a gameset first." },
  "gm.selectGameset": { tr: "Gameset sec...", en: "Select gameset..." },
  "gm.creating": { tr: "Olusturuluyor...", en: "Creating..." },
  "gm.createRoom": { tr: "Oda Olustur", en: "Create Room" },

  // ─── Session List ──────────────────────────────────────
  "session.myRooms": { tr: "Odalarim", en: "My Rooms" },
  "session.joinedRooms": { tr: "Katildigim Odalar", en: "Joined Rooms" },
  "session.filterAll": { tr: "Hepsi", en: "All" },
  "session.statusOpen": { tr: "Acik", en: "Open" },
  "session.statusActive": { tr: "Aktif", en: "Active" },
  "session.statusClosed": { tr: "Kapali", en: "Closed" },
  "session.enterRoom": { tr: "Odaya Gir", en: "Enter Room" },
  "session.start": { tr: "Baslat", en: "Start" },
  "session.closeRoom": { tr: "Kapat", en: "Close" },
  "session.confirmClose": { tr: "Bu odayi kapatmak istediginize emin misiniz?", en: "Are you sure you want to close this room?" },
  "session.noRoomsGm": { tr: "Henuz bir oda olusturmadin.", en: "You haven't created any rooms yet." },
  "session.noRoomsPlayer": { tr: "Henuz bir odaya katilmadin. GM'inden davet kodu iste.", en: "You haven't joined any rooms yet. Ask your GM for an invite code." },
  "session.noFilterResults": { tr: "Bu filtreye uygun oda bulunamadi.", en: "No rooms match this filter." },
  "session.confirmDelete": { tr: "Emin misiniz?", en: "Are you sure?" },
  "session.confirmRemove": { tr: "Bu odayi listenizden kaldirmak istediginize emin misiniz?", en: "Are you sure you want to remove this room from your list?" },

  // ─── Join Session ──────────────────────────────────────
  "join.title": { tr: "Odaya Katil", en: "Join Room" },
  "join.inviteCode": { tr: "Davet kodu", en: "Invite code" },
  "join.success": { tr: "Odaya basariyla katildin!", en: "Successfully joined the room!" },
  "join.processing": { tr: "Katilim isleniyor...", en: "Processing..." },
  "join.redirecting": { tr: "Dashboard'a yonlendiriliyorsun...", en: "Redirecting to dashboard..." },
  "join.backToDashboard": { tr: "Dashboard'a Don", en: "Back to Dashboard" },

  // ─── Room (Session Room) ───────────────────────────────
  "room.backToDashboard": { tr: "Dashboard", en: "Dashboard" },
  "room.clickToCopy": { tr: "Kopyalamak icin tikla", en: "Click to copy" },
  "room.connected": { tr: "Bagli", en: "Connected" },
  "room.disconnected": { tr: "Baglanti yok", en: "Disconnected" },
  "room.noCharacter": { tr: "Bu odada henuz bir karakteriniz yok.", en: "You don't have a character in this room yet." },
  "room.createCharacter": { tr: "Karakter Olustur", en: "Create Character" },
  "room.pendingApproval": { tr: "Karakter olusturma isteginiz GM onayi bekliyor.", en: "Your character creation request is pending GM approval." },
  "room.rejected": { tr: "Karakter isteginiz reddedildi.", en: "Your character request was rejected." },
  "room.chatTab": { tr: "Sohbet", en: "Chat" },
  "room.playersTab": { tr: "Oyuncular", en: "Players" },
  "room.diceTab": { tr: "Zar", en: "Dice" },

  // ─── Chat ──────────────────────────────────────────────
  "chat.ic": { tr: "Karakter Olarak", en: "In-Character" },
  "chat.ooc": { tr: "Karakter Disi", en: "Out-of-Character" },
  "chat.icPlaceholder": { tr: "Karakterin olarak yaz...", en: "Write as your character..." },
  "chat.oocPlaceholder": { tr: "Mesajini yaz...", en: "Type a message..." },

  // ─── Dice ──────────────────────────────────────────────
  "dice.title": { tr: "Zar", en: "Dice" },
  "dice.roll": { tr: "At", en: "Roll" },

  // ─── Character Detail (GM view) ───────────────────────
  "charDetail.stats": { tr: "Statlar", en: "Stats" },
  "charDetail.inventory": { tr: "Envanter", en: "Inventory" },
  "charDetail.spells": { tr: "Buyuler", en: "Spells" },
  "charDetail.resources": { tr: "Kaynaklar", en: "Resources" },
  "charDetail.attributes": { tr: "Nitelikler", en: "Attributes" },
  "charDetail.backstory": { tr: "Hikaye", en: "Backstory" },
  "charDetail.customFields": { tr: "Ek Bilgiler", en: "Additional Info" },
  "charDetail.equipped": { tr: "Kusanilmis", en: "Equipped" },
  "charDetail.emptyInventory": { tr: "Envanter bos.", en: "Inventory is empty." },
  "charDetail.noSpells": { tr: "Bilinen buyu yok.", en: "No known spells." },
  "charDetail.noInfo": { tr: "Bu karakter hakkinda goruntulecek bilgi yok.", en: "No information to display about this character." },
  "charDetail.turn": { tr: "tur", en: "turn" },
  "charDetail.range": { tr: "Menzil:", en: "Range:" },

  // ─── Approval Panel ────────────────────────────────────
  "approval.title": { tr: "Karakter Onaylari", en: "Character Approvals" },
  "approval.rejectReason": { tr: "Red sebebi (opsiyonel):", en: "Rejection reason (optional):" },

  // ─── Character Sheet ───────────────────────────────────
  "charSheet.resources": { tr: "Kaynaklar", en: "Resources" },
  "charSheet.attributes": { tr: "Nitelikler", en: "Attributes" },

  // ─── Inventory ─────────────────────────────────────────
  "inv.head": { tr: "Kafa", en: "Head" },
  "inv.chest": { tr: "Gogus", en: "Chest" },
  "inv.legs": { tr: "Bacak", en: "Legs" },
  "inv.feet": { tr: "Ayak", en: "Feet" },
  "inv.mainHand": { tr: "Ana El", en: "Main Hand" },
  "inv.offHand": { tr: "Yan El", en: "Off Hand" },
  "inv.accessory1": { tr: "Aksesuar 1", en: "Accessory 1" },
  "inv.accessory2": { tr: "Aksesuar 2", en: "Accessory 2" },

  // ─── Spells ────────────────────────────────────────────
  "spell.self": { tr: "Kendine", en: "Self" },
  "spell.single": { tr: "Tekli", en: "Single" },
  "spell.aoe": { tr: "Alan", en: "AoE" },
  "spell.line": { tr: "Cizgi", en: "Line" },

  // ─── Character Wizard ──────────────────────────────────
  "wizard.title": { tr: "Karakter Olustur", en: "Create Character" },
  "wizard.stepRace": { tr: "Irk", en: "Race" },
  "wizard.stepClass": { tr: "Sinif", en: "Class" },
  "wizard.stepSkills": { tr: "Yetenekler", en: "Skills" },
  "wizard.stepDetails": { tr: "Detaylar", en: "Details" },
  "wizard.stepSummary": { tr: "Ozet", en: "Summary" },
  "wizard.pendingTitle": { tr: "Onay Bekleniyor", en: "Pending Approval" },
  "wizard.pendingMsg": { tr: "Karakter olusturma isteginiz GM onayi bekliyor. GM onayladiginda karakteriniz olusturulacak.", en: "Your character creation request is pending GM approval. Your character will be created once the GM approves." },
  "wizard.backToRoom": { tr: "Odaya Don", en: "Back to Room" },
  "wizard.next": { tr: "Ileri", en: "Next" },
  "wizard.prev": { tr: "Geri", en: "Back" },
  "wizard.submit": { tr: "Gonder", en: "Submit" },
  "wizard.selectRace": { tr: "Irk Secin", en: "Select Race" },
  "wizard.noRaces": { tr: "Bu gameset'te henuz irk tanimlanmamis. GM'e bildirin.", en: "No races defined in this gameset yet. Notify the GM." },
  "wizard.selectClass": { tr: "Sinif Secin", en: "Select Class" },
  "wizard.noClasses": { tr: "Bu gameset'te henuz sinif tanimlanmamis. GM'e bildirin.", en: "No classes defined in this gameset yet. Notify the GM." },
  "wizard.allocateSkills": { tr: "Yetenek Puanlari Dagit", en: "Allocate Skill Points" },
  "wizard.listView": { tr: "liste", en: "list" },
  "wizard.mapView": { tr: "harita", en: "map" },
  "wizard.detailsTitle": { tr: "Karakter Detaylari", en: "Character Details" },
  "wizard.charName": { tr: "Karakter Adi", en: "Character Name" },
  "wizard.backstory": { tr: "Hikaye / Backstory", en: "Backstory" },
  "wizard.backstoryPlaceholder": { tr: "Karakterinizin gecmisi, motivasyonlari...", en: "Your character's history, motivations..." },
  "wizard.customFields": { tr: "Ek Bilgiler", en: "Additional Info" },
  "wizard.customFieldPlaceholder": { tr: "Baslik (or. Kisilik, Gorunum, Notlar...)", en: "Title (e.g. Personality, Appearance, Notes...)" },
  "wizard.summaryTitle": { tr: "Karakter Ozeti", en: "Character Summary" },
  "wizard.race": { tr: "Irk", en: "Race" },
  "wizard.class": { tr: "Sinif", en: "Class" },
  "wizard.skillPoints": { tr: "Skill Puanlari", en: "Skill Points" },
  "wizard.spent": { tr: "harcandi", en: "spent" },
  "wizard.submitting": { tr: "Gonderiliyor...", en: "Submitting..." },
  "wizard.submitToGm": { tr: "GM Onayina Gonder", en: "Submit for GM Approval" },

  // ─── Gameset Editor ────────────────────────────────────
  "editor.badge": { tr: "Gameset Editoru", en: "Gameset Editor" },
  "editor.tabGeneral": { tr: "Genel", en: "General" },
  "editor.tabStats": { tr: "Stat Tanimlari", en: "Stat Definitions" },
  "editor.tabClassRace": { tr: "Sinif & Irk", en: "Class & Race" },
  "editor.tabSkillTree": { tr: "Skill Agaci", en: "Skill Tree" },
  "editor.tabSpells": { tr: "Buyuler", en: "Spells" },
  "editor.tabItems": { tr: "Esyalar", en: "Items" },

  // ─── General Tab ───────────────────────────────────────
  "general.settings": { tr: "Genel Ayarlar", en: "General Settings" },
  "general.gamesetName": { tr: "Gameset Adi", en: "Gameset Name" },
  "general.description": { tr: "Aciklama", en: "Description" },
  "general.gameRules": { tr: "Oyun Kurallari", en: "Game Rules" },
  "general.maxLevel": { tr: "Maksimum Seviye", en: "Maximum Level" },
  "general.startSkillPoints": { tr: "Baslangic Skill Puani", en: "Starting Skill Points" },

  // ─── Stats Tab ─────────────────────────────────────────
  "stats.groups": { tr: "Stat Gruplari", en: "Stat Groups" },

  // ─── Class & Race Tab ──────────────────────────────────
  "classRace.classes": { tr: "Siniflar", en: "Classes" },
  "classRace.races": { tr: "Irklar", en: "Races" },

  // ─── Skill Tree Tab ────────────────────────────────────
  "skillTree.tree": { tr: "Agac:", en: "Tree:" },
  "skillTree.commonTree": { tr: "Ortak Agac", en: "Common Tree" },
  "skillTree.node": { tr: "node", en: "node" },

  // ─── Spells Tab ────────────────────────────────────────
  "spells.definitions": { tr: "Buyu Tanimlari", en: "Spell Definitions" },
  "spells.editSpell": { tr: "Buyuyu Duzenle", en: "Edit Spell" },
  "spells.newSpell": { tr: "Yeni Buyu", en: "New Spell" },
  "spells.targetType": { tr: "Hedef Tipi", en: "Target Type" },

  // ─── Items Tab ─────────────────────────────────────────
  "items.weapon": { tr: "Silah", en: "Weapon" },
  "items.armor": { tr: "Zirh", en: "Armor" },
  "items.consumable": { tr: "Sarf", en: "Consumable" },
  "items.material": { tr: "Malzeme", en: "Material" },
  "items.quest": { tr: "Gorev", en: "Quest" },
  "items.other": { tr: "Diger", en: "Other" },
  "items.noSlot": { tr: "Yok (Kusanilamaz)", en: "None (Cannot Equip)" },
  "items.common": { tr: "Siradan", en: "Common" },
  "items.uncommon": { tr: "Nadir Olmayan", en: "Uncommon" },
  "items.rare": { tr: "Nadir", en: "Rare" },
  "items.epic": { tr: "Epik", en: "Epic" },
  "items.legendary": { tr: "Efsanevi", en: "Legendary" },
} as const;

export type TranslationKey = keyof typeof translations;
