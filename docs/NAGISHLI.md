# התקנת תוסף הנגישות NagishLi (נגיש לי)

התוסף כבר מחובר בקוד (`app/layout.tsx` טוען `/nagishli.js`). כדי להפעיל אותו
בפועל נשאר צעד ידני אחד — הורדת קבצי התוסף והוספתם ל-repo:

1. היכנסו אל https://www.nagish.li/download.html והורידו את גרסה 2.3 (ZIP).
2. חלצו את הקובץ ומתוכו העתיקו אל תיקיית `public/` של הפרויקט:
   - `nagishli.js`
   - את התיקייה `nl-files/` בשלמותה
   כך שיתקבל: `public/nagishli.js` ו-`public/nl-files/...`
3. `git add public/nagishli.js public/nl-files && git commit -m "chore: add NagishLi accessibility widget files" && git push`

זהו — אחרי ה-deploy יופיע כפתור הנגישות בכל עמודי האתר.

## התאמות (רשות)

בקובץ `nagishli.js` יש בלוק הגדרות בראש הקובץ: שפה (עברית), צבע, פינה
התחלתית, וקישור להצהרת הנגישות — שימו שם `/accessibility` (העמוד מנוהל
מעורך המסמכים באדמין).

## רישיון

NagishLi מסופק חינם ע"י Localize* בכפוף לתנאי הרישיון שלו — הקרדיט המובנה
בתוסף חייב להישאר. פרטים: https://www.nagish.li/license.html

הערה: כל עוד הקבצים לא הועלו, הבקשה ל-`/nagishli.js` מחזירה 404 שקט
והאתר עובד כרגיל — אין תלות קשיחה.
