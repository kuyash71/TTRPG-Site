export type Locale = "tr" | "en";

export const translations = {
  // ─── Common ────────────────────────────────────────────
  "common.save": { tr: "Kaydet", en: "Save" },
  "common.cancel": { tr: "İptal", en: "Cancel" },
  "common.delete": { tr: "Sil", en: "Delete" },
  "common.edit": { tr: "Düzenle", en: "Edit" },
  "common.create": { tr: "Oluştur", en: "Create" },
  "common.close": { tr: "Kapat", en: "Close" },
  "common.back": { tr: "Geri", en: "Back" },
  "common.loading": { tr: "Yükleniyor...", en: "Loading..." },
  "common.saving": { tr: "Kaydediliyor...", en: "Saving..." },
  "common.saved": { tr: "Kaydedildi", en: "Saved" },
  "common.error": { tr: "Bir hata oluştu.", en: "An error occurred." },
  "common.confirm": { tr: "Onayla", en: "Confirm" },
  "common.areYouSure": { tr: "Emin misiniz?", en: "Are you sure?" },
  "common.giveUp": { tr: "Vazgeç", en: "Cancel" },
  "common.send": { tr: "Gönder", en: "Send" },
  "common.join": { tr: "Katıl", en: "Join" },
  "common.remove": { tr: "Kaldır", en: "Remove" },
  "common.approve": { tr: "Onayla", en: "Approve" },
  "common.reject": { tr: "Reddet", en: "Reject" },
  "common.tryAgain": { tr: "Tekrar Dene", en: "Try Again" },
  "common.add": { tr: "Ekle", en: "Add" },
  "common.name": { tr: "Ad", en: "Name" },
  "common.description": { tr: "Açıklama", en: "Description" },
  "common.level": { tr: "Seviye", en: "Level" },
  "common.yours": { tr: "Senin", en: "Yours" },
  "common.private": { tr: "Gizli", en: "Private" },
  "common.untitled": { tr: "Başlıksız", en: "Untitled" },
  "common.errorOccurred": { tr: "Hata oluştu", en: "Error occurred" },
  "common.players": { tr: "Oyuncular", en: "Players" },
  "common.player": { tr: "oyuncu", en: "player" },
  "common.noPermission": { tr: "Yetkiniz yok.", en: "No permission." },
  "common.notFound": { tr: "Bulunamadı.", en: "Not found." },

  // ─── Auth ──────────────────────────────────────────────
  "auth.login": { tr: "Giriş Yap", en: "Sign In" },
  "auth.register": { tr: "Kayıt Ol", en: "Sign Up" },
  "auth.logout": { tr: "Çıkış Yap", en: "Sign Out" },
  "auth.email": { tr: "Email", en: "Email" },
  "auth.password": {
    tr: "Şifre (en az 6 karakter)",
    en: "Password (min 6 characters)",
  },
  "auth.username": { tr: "Kullanıcı Adı", en: "Username" },
  "auth.loginError": {
    tr: "Email veya şifre hatalı.",
    en: "Invalid email or password.",
  },
  "auth.loggingIn": { tr: "Giriş yapılıyor...", en: "Signing in..." },
  "auth.registering": { tr: "Kaydediliyor...", en: "Registering..." },
  "auth.noAccount": { tr: "Hesabın yok mu?", en: "Don't have an account?" },
  "auth.hasAccount": {
    tr: "Zaten hesabın var mı?",
    en: "Already have an account?",
  },

  // ─── Dashboard ─────────────────────────────────────────
  "dashboard.title": { tr: "Dashboard", en: "Dashboard" },
  "dashboard.welcome": { tr: "Hoş geldin,", en: "Welcome," },

  // ─── GM Panel ──────────────────────────────────────────
  "gm.panel": { tr: "GM Paneli", en: "GM Panel" },
  "gm.newGameset": { tr: "Yeni Gameset", en: "New Gameset" },
  "gm.newRoom": { tr: "Yeni Oda", en: "New Room" },
  "gm.gamesetName": { tr: "Gameset adı", en: "Gameset name" },
  "gm.yourGamesets": { tr: "Gameset'lerin", en: "Your Gamesets" },
  "gm.deleteGameset": { tr: "Gameset Sil", en: "Delete Gameset" },
  "gm.deleteGamesetWarning": {
    tr: "Bu işlem geri alınamaz. Gameset'e bağlı tüm kapatılmış odalar, karakterler ve veriler kalıcı olarak silinecektir. Onaylamak için gameset adını yazın:",
    en: "This action cannot be undone. All closed rooms, characters, and data associated with this gameset will be permanently deleted. Type the gameset name to confirm:",
  },
  "gm.deleting": { tr: "Siliniyor...", en: "Deleting..." },
  "gm.deletePermanently": { tr: "Kalıcı Olarak Sil", en: "Delete Permanently" },
  "gm.deleteFailed": { tr: "Silinemedi.", en: "Delete failed." },
  "gm.roomName": { tr: "Oda adı", en: "Room name" },
  "gm.createGamesetFirst": {
    tr: "Önce bir gameset oluşturun.",
    en: "Create a gameset first.",
  },
  "gm.selectGameset": { tr: "Gameset seç...", en: "Select gameset..." },
  "gm.creating": { tr: "Oluşturuluyor...", en: "Creating..." },
  "gm.createRoom": { tr: "Oda Oluştur", en: "Create Room" },

  // ─── Session List ──────────────────────────────────────
  "session.myRooms": { tr: "Odalarım", en: "My Rooms" },
  "session.joinedRooms": { tr: "Katıldığım Odalar", en: "Joined Rooms" },
  "session.filterAll": { tr: "Hepsi", en: "All" },
  "session.statusOpen": { tr: "Açık", en: "Open" },
  "session.statusActive": { tr: "Aktif", en: "Active" },
  "session.statusClosed": { tr: "Kapalı", en: "Closed" },
  "session.enterRoom": { tr: "Odaya Gir", en: "Enter Room" },
  "session.start": { tr: "Başlat", en: "Start" },
  "session.closeRoom": { tr: "Kapat", en: "Close" },
  "session.confirmClose": {
    tr: "Bu odayı kapatmak istediğinize emin misiniz?",
    en: "Are you sure you want to close this room?",
  },
  "session.noRoomsGm": {
    tr: "Henüz bir oda oluşturmadın.",
    en: "You haven't created any rooms yet.",
  },
  "session.noRoomsPlayer": {
    tr: "Henüz bir odaya katılmadın. GM'inden davet kodu iste.",
    en: "You haven't joined any rooms yet. Ask your GM for an invite code.",
  },
  "session.noFilterResults": {
    tr: "Bu filtreye uygun oda bulunamadı.",
    en: "No rooms match this filter.",
  },
  "session.confirmDelete": { tr: "Emin misiniz?", en: "Are you sure?" },
  "session.confirmRemove": {
    tr: "Bu odayı listenizden kaldırmak istediğinize emin misiniz?",
    en: "Are you sure you want to remove this room from your list?",
  },

  // ─── Join Session ──────────────────────────────────────
  "join.title": { tr: "Odaya Katıl", en: "Join Room" },
  "join.inviteCode": { tr: "Davet kodu", en: "Invite code" },
  "join.success": {
    tr: "Odaya başarıyla katıldın!",
    en: "Successfully joined the room!",
  },
  "join.processing": { tr: "Katılım işleniyor...", en: "Processing..." },
  "join.redirecting": {
    tr: "Dashboard'a yönlendiriliyorsun...",
    en: "Redirecting to dashboard...",
  },
  "join.backToDashboard": { tr: "Dashboard'a Dön", en: "Back to Dashboard" },

  // ─── Room (Session Room) ───────────────────────────────
  "room.backToDashboard": { tr: "Dashboard", en: "Dashboard" },
  "room.clickToCopy": { tr: "Kopyalamak için tıkla", en: "Click to copy" },
  "room.connected": { tr: "Bağlı", en: "Connected" },
  "room.disconnected": { tr: "Bağlantı yok", en: "Disconnected" },
  "room.noCharacter": {
    tr: "Bu odada henüz bir karakteriniz yok.",
    en: "You don't have a character in this room yet.",
  },
  "room.createCharacter": { tr: "Karakter Oluştur", en: "Create Character" },
  "room.pendingApproval": {
    tr: "Karakter oluşturma isteğiniz GM onayı bekliyor.",
    en: "Your character creation request is pending GM approval.",
  },
  "room.rejected": {
    tr: "Karakter isteğiniz reddedildi.",
    en: "Your character request was rejected.",
  },
  "room.chatTab": { tr: "Sohbet", en: "Chat" },
  "room.playersTab": { tr: "Oyuncular", en: "Players" },
  "room.diceTab": { tr: "Zar", en: "Dice" },

  // ─── Chat ──────────────────────────────────────────────
  "chat.ic": { tr: "Karakter Olarak", en: "In-Character" },
  "chat.ooc": { tr: "Karakter Dışı", en: "Out-of-Character" },
  "chat.icPlaceholder": {
    tr: "Karakterin olarak yaz...",
    en: "Write as your character...",
  },
  "chat.oocPlaceholder": { tr: "Mesajını yaz...", en: "Type a message..." },

  // ─── Dice ──────────────────────────────────────────────
  "dice.title": { tr: "Zar", en: "Dice" },
  "dice.roll": { tr: "At", en: "Roll" },

  // ─── Character Detail (GM view) ───────────────────────
  "charDetail.stats": { tr: "Statlar", en: "Stats" },
  "charDetail.inventory": { tr: "Envanter", en: "Inventory" },
  "charDetail.spells": { tr: "Büyüler", en: "Spells" },
  "charDetail.resources": { tr: "Kaynaklar", en: "Resources" },
  "charDetail.attributes": { tr: "Nitelikler", en: "Attributes" },
  "charDetail.backstory": { tr: "Hikaye", en: "Backstory" },
  "charDetail.customFields": { tr: "Ek Bilgiler", en: "Additional Info" },
  "charDetail.equipped": { tr: "Kuşanılmış", en: "Equipped" },
  "charDetail.emptyInventory": {
    tr: "Envanter boş.",
    en: "Inventory is empty.",
  },
  "charDetail.noSpells": { tr: "Bilinen büyü yok.", en: "No known spells." },
  "charDetail.noInfo": {
    tr: "Bu karakter hakkında görüntülenecek bilgi yok.",
    en: "No information to display about this character.",
  },
  "charDetail.turn": { tr: "tür", en: "turn" },
  "charDetail.range": { tr: "Menzil:", en: "Range:" },

  // ─── Approval Panel ────────────────────────────────────
  "approval.title": { tr: "Karakter Onayları", en: "Character Approvals" },
  "approval.rejectReason": {
    tr: "Red sebebi (opsiyonel):",
    en: "Rejection reason (optional):",
  },

  // ─── Character Sheet ───────────────────────────────────
  "charSheet.resources": { tr: "Kaynaklar", en: "Resources" },
  "charSheet.attributes": { tr: "Nitelikler", en: "Attributes" },

  // ─── Inventory ─────────────────────────────────────────
  "inv.head": { tr: "Kafa", en: "Head" },
  "inv.chest": { tr: "Göğüs", en: "Chest" },
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
  "spell.line": { tr: "Çizgi", en: "Line" },

  // ─── Character Wizard ──────────────────────────────────
  "wizard.title": { tr: "Karakter Oluştur", en: "Create Character" },
  "wizard.stepRace": { tr: "Irk", en: "Race" },
  "wizard.stepClass": { tr: "Sınıf", en: "Class" },
  "wizard.stepSkills": { tr: "Yetenekler", en: "Skills" },
  "wizard.stepDetails": { tr: "Detaylar", en: "Details" },
  "wizard.stepSummary": { tr: "Özet", en: "Summary" },
  "wizard.pendingTitle": { tr: "Onay Bekleniyor", en: "Pending Approval" },
  "wizard.pendingMsg": {
    tr: "Karakter oluşturma isteğiniz GM onayı bekliyor. GM onayladığında karakteriniz oluşturulacak.",
    en: "Your character creation request is pending GM approval. Your character will be created once the GM approves.",
  },
  "wizard.backToRoom": { tr: "Odaya Dön", en: "Back to Room" },
  "wizard.next": { tr: "İleri", en: "Next" },
  "wizard.prev": { tr: "Geri", en: "Back" },
  "wizard.submit": { tr: "Gönder", en: "Submit" },
  "wizard.selectRace": { tr: "Irk Seçin", en: "Select Race" },
  "wizard.noRaces": {
    tr: "Bu gameset'te henüz ırk tanımlanmamış. GM'e bildirin.",
    en: "No races defined in this gameset yet. Notify the GM.",
  },
  "wizard.selectClass": { tr: "Sınıf Seçin", en: "Select Class" },
  "wizard.noClasses": {
    tr: "Bu gameset'te henüz sınıf tanımlanmamış. GM'e bildirin.",
    en: "No classes defined in this gameset yet. Notify the GM.",
  },
  "wizard.allocateSkills": {
    tr: "Yetenek Puanları Dağıt",
    en: "Allocate Skill Points",
  },
  "wizard.listView": { tr: "liste", en: "list" },
  "wizard.mapView": { tr: "harita", en: "map" },
  "wizard.detailsTitle": { tr: "Karakter Detayları", en: "Character Details" },
  "wizard.charName": { tr: "Karakter Adı", en: "Character Name" },
  "wizard.backstory": { tr: "Hikaye / Backstory", en: "Backstory" },
  "wizard.backstoryPlaceholder": {
    tr: "Karakterinizin geçmişi, motivasyonları...",
    en: "Your character's history, motivations...",
  },
  "wizard.customFields": { tr: "Ek Bilgiler", en: "Additional Info" },
  "wizard.customFieldPlaceholder": {
    tr: "Başlık (ör. Kişilik, Görünüm, Notlar...)",
    en: "Title (e.g. Personality, Appearance, Notes...)",
  },
  "wizard.summaryTitle": { tr: "Karakter Özeti", en: "Character Summary" },
  "wizard.race": { tr: "Irk", en: "Race" },
  "wizard.class": { tr: "Sınıf", en: "Class" },
  "wizard.skillPoints": { tr: "Skill Puanları", en: "Skill Points" },
  "wizard.spent": { tr: "harcandı", en: "spent" },
  "wizard.submitting": { tr: "Gönderiliyor...", en: "Submitting..." },
  "wizard.submitToGm": {
    tr: "GM Onayına Gönder",
    en: "Submit for GM Approval",
  },

  // ─── Gameset Editor ────────────────────────────────────
  "editor.badge": { tr: "Gameset Editörü", en: "Gameset Editor" },
  "editor.tabGeneral": { tr: "Genel", en: "General" },
  "editor.tabStats": { tr: "Stat Tanımları", en: "Stat Definitions" },
  "editor.tabClassRace": { tr: "Sınıf & Irk", en: "Class & Race" },
  "editor.tabSkillTree": { tr: "Skill Ağacı", en: "Skill Tree" },
  "editor.tabSpells": { tr: "Büyüler", en: "Spells" },
  "editor.tabItems": { tr: "Eşyalar", en: "Items" },

  // ─── General Tab ───────────────────────────────────────
  "general.settings": { tr: "Genel Ayarlar", en: "General Settings" },
  "general.gamesetName": { tr: "Gameset Adı", en: "Gameset Name" },
  "general.description": { tr: "Açıklama", en: "Description" },
  "general.gameRules": { tr: "Oyun Kuralları", en: "Game Rules" },
  "general.maxLevel": { tr: "Maksimum Seviye", en: "Maximum Level" },
  "general.startSkillPoints": {
    tr: "Başlangıç Skill Puanı",
    en: "Starting Skill Points",
  },

  // ─── Stats Tab ─────────────────────────────────────────
  "stats.groups": { tr: "Stat Grupları", en: "Stat Groups" },

  // ─── Class & Race Tab ──────────────────────────────────
  "classRace.classes": { tr: "Sınıflar", en: "Classes" },
  "classRace.races": { tr: "Irklar", en: "Races" },

  // ─── Skill Tree Tab ────────────────────────────────────
  "skillTree.tree": { tr: "Ağaç:", en: "Tree:" },
  "skillTree.commonTree": { tr: "Ortak Ağaç", en: "Common Tree" },
  "skillTree.node": { tr: "node", en: "node" },

  // ─── Spells Tab ────────────────────────────────────────
  "spells.definitions": { tr: "Büyü Tanımları", en: "Spell Definitions" },
  "spells.editSpell": { tr: "Büyüyü Düzenle", en: "Edit Spell" },
  "spells.newSpell": { tr: "Yeni Büyü", en: "New Spell" },
  "spells.targetType": { tr: "Hedef Tipi", en: "Target Type" },

  // ─── Items Tab ─────────────────────────────────────────
  "items.weapon": { tr: "Silah", en: "Weapon" },
  "items.armor": { tr: "Zırh", en: "Armor" },
  "items.consumable": { tr: "Sarf", en: "Consumable" },
  "items.material": { tr: "Malzeme", en: "Material" },
  "items.quest": { tr: "Görev", en: "Quest" },
  "items.other": { tr: "Diğer", en: "Other" },
  "items.noSlot": { tr: "Yok (Kuşanılamaz)", en: "None (Cannot Equip)" },
  "items.common": { tr: "Sıradan", en: "Common" },
  "items.uncommon": { tr: "Nadir Olmayan", en: "Uncommon" },
  "items.rare": { tr: "Nadir", en: "Rare" },
  "items.epic": { tr: "Epik", en: "Epic" },
  "items.legendary": { tr: "Efsanevi", en: "Legendary" },
} as const;

export type TranslationKey = keyof typeof translations;
