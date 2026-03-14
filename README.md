# Hidden Council Online

لعبة Browser Online مستوحاة من فكرة **Secret Hitler** ولكن باسم محايد ومشروع Static يشتغل على **GitHub Pages**.

## ماذا يوجد داخل المشروع؟
- إنشاء غرفة Room Code
- دخول لاعبين من أجهزة مختلفة
- Lobby حتى 10 لاعبين
- توزيع أدوار تلقائي
- President / Chancellor nomination
- تصويت Ja / Nein
- Deck + discard + election tracker
- تمرير قوانين Liberal / Authoritarian
- Execution phase في المراحل المتقدمة
- Win conditions الأساسية
- Log للأحداث

## نقطة مهمة جدًا
لأن المشروع **Static Frontend** ويعتمد على **Firebase Realtime Database** بدون Backend خاص:
- يشتغل بسهولة على GitHub Pages
- لا يحتاج Node server
- لكنه **ليس آمنًا ضد الغش التقني 100%**
- مناسب كبداية / Prototype / Casual Play

لو أردت لاحقًا نسخة أكثر أمانًا، الحل الصحيح هو:
- Backend حقيقي (Node.js + Socket.IO)
- أو Cloud Functions + قواعد أمان أقوى

## هيكل الملفات

```text
hidden-council-online/
├─ index.html
├─ styles.css
├─ README.md
└─ js/
   ├─ app.js
   ├─ firebase.js
   ├─ firebase-config.js
   ├─ firebase-config.example.js
   └─ game-logic.js
```

## التشغيل المحلي
يكفي فتح المشروع عبر Live Server في VS Code.

## إعداد Firebase

### 1) أنشئ مشروع Firebase
من Firebase Console أنشئ مشروع جديد.

### 2) فعّل Realtime Database
- أنشئ Realtime Database
- ابدأ في Test Mode أثناء التجربة

### 3) فعّل Web App
أضف Web App واحصل على config.

### 4) ضع بياناتك هنا
افتح الملف:

```js
js/firebase-config.js
```

واستبدل القيم الوهمية بالقيم الحقيقية من Firebase.

## Rules مبدئية للتجربة
في Realtime Database Rules استخدم مؤقتًا هذه القواعد للتجربة:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

هذه القواعد **غير مناسبة للإنتاج**، لكنها جيدة للتشغيل السريع والتجربة.

## الرفع على GitHub

### 1) ارفع الملفات إلى Repository
مثلاً:
- Repository name: `hidden-council-online`

### 2) فعّل GitHub Pages
- Settings
- Pages
- Source = Deploy from a branch
- Branch = `main`
- Folder = `/ (root)`

### 3) سيفتح لك رابط مثل:

```text
https://YOUR_USERNAME.github.io/hidden-council-online/
```

## ملاحظات مهمة

### 1) السرية الفعلية للأدوار
في لعبة Social Deduction حقيقية، الأفضل أن الأدوار تُدار على Server آمن.
في هذه النسخة، اللاعب العادي سيشاهد فقط دوره من الواجهة، لكن مستخدمًا متقدمًا تقنيًا قد يتمكن من استكشاف البيانات.

### 2) الانضمام بعد بدء الجولة
النسخة الحالية مصممة أساسًا للانضمام قبل بدء اللعبة.

### 3) تحسينات مستقبلية مقترحة
- منع إعادة ترشيح الحكومة السابقة حسب القواعد الكاملة
- Investigate / Special Powers إضافية
- Chat داخلي
- شاشة قوانين أوضح
- إعادة بدء الجولة بدون Refresh
- Backend آمن بـ Socket.IO

## أفضل طريقة استخدام الآن
- Host ينشئ الغرفة
- يرسل Room Code لباقي اللاعبين
- كل لاعب يدخل من جهازه
- عند اكتمال العدد، Host يبدأ اللعبة

