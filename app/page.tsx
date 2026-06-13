import Link from 'next/link';

export default function HomePage() {
    return (
          <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-8" dir="rtl">
                <div className="max-w-2xl w-full text-center">
                        <div className="mb-8">
                                  <h1 className="text-5xl font-bold text-indigo-800 mb-4">
                                              🏆 סוכן מכרזים
                                  </h1>h1>
                                  <p className="text-xl text-gray-600">
                                              AI אישי שמוצא עבורך מכרזים רלוונטיים כל יום
                                  </p>p>
                        </div>div>
                
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                                              <div className="text-3xl mb-2">🔍</div>div>
                                              <h3 className="font-semibold text-gray-800 mb-1">סריקה יומית</h3>h3>
                                              <p className="text-sm text-gray-500">סורק את כל המכרזים הממשלתיים כל בוקר</p>p>
                                  </div>div>
                                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                                              <div className="text-3xl mb-2">🎯</div>div>
                                              <h3 className="font-semibold text-gray-800 mb-1">התאמה אישית</h3>h3>
                                              <p className="text-sm text-gray-500">מסנן רק מכרזים שמתאימים לעסק שלך</p>p>
                                  </div>div>
                                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                                              <div className="text-3xl mb-2">📱</div>div>
                                              <h3 className="font-semibold text-gray-800 mb-1">התראות מיידיות</h3>h3>
                                              <p className="text-sm text-gray-500">מקבל עדכונים בוואטסאפ או במייל</p>p>
                                  </div>div>
                        </div>div>
                
                        <Link
                                    href="/register"
                                    className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xl px-10 py-4 rounded-2xl shadow-lg transition-all hover:scale-105"
                                  >
                                  התחל עכשיו — בחינם
                        </Link>Link>
                
                        <p className="mt-4 text-sm text-gray-400">
                                  מעל 450,000 עסקים בישראל זכאים להגיש מכרזים — פחות מ-1% עושים זאת
                        </p>p>
                </div>div>
          </main>main>
        );
}</main>
