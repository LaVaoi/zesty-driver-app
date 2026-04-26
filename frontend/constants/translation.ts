// constants/translations.ts
// Zesty Driver — full bilingual string table (English + Arabic)
// Usage: translations[lang].key.subkey

export type Language = 'en' | 'ar';

export type TranslationSchema = typeof en;

const en = {
  // ─── Common ───────────────────────────────────────────────────────────────
  common: {
    appName:          'Zesty Driver',
    eyebrow:          'ZESTY DRIVER',
    save:             'Save',
    cancel:           'Cancel',
    confirm:          'Confirm',
    close:            'Close',
    retry:            'Try Again',
    refresh:          'Refresh',
    loading:          'Loading…',
    loadingMap:       'Loading map…',
    ok:               'OK',
    yes:              'Yes',
    no:               'No',
    notAvailable:     'Not available',
    version:          'v1.0.0  ·  Delivery Partner App',
    error:            'Error',
    success:          'Success',
    networkError:     'Network error. Please check your connection.',
    sessionExpired:   'Session Expired',
    sessionExpiredMsg:'Please login again',
    authRequired:     'Authentication required',
    comingSoon:       'Coming Soon',
  },

  // ─── Login ────────────────────────────────────────────────────────────────
  login: {
    title:             'Zesty Driver',
    subtitle:          'Sign in to start delivering',
    secureLogin:       'SECURE LOGIN',
    driverAuth:        'DRIVER AUTHENTICATION',
    emailLabel:        'EMAIL ADDRESS',
    emailPlaceholder:  'driver@example.com',
    passwordLabel:     'PASSWORD',
    passwordPlaceholder:'Enter your password',
    forgotPassword:    'Forgot password?',
    signIn:            'Sign In',
    needHelp:          'Need help? Contact support',
    missingFields:     'Missing fields',
    missingFieldsMsg:  'Please enter both email and password.',
    loginFailed:       'Login failed',
    invalidCredentials:'Invalid credentials.',
    invalidResponse:   'Invalid server response',
    somethingWrong:    'Something went wrong.',
  },

  // ─── Tab Bar ──────────────────────────────────────────────────────────────
  tabs: {
    home:          'HOME',
    orders:        'ORDERS',
    alerts:        'ALERTS',
    profile:       'PROFILE',
  },

  // ─── Notifications Screen ─────────────────────────────────────────────────
  notifications: {
    title:             'Notifications',
    screenTitle:       'NOTIFICATIONS',
    unreadCount:       (n: number) => `${n} unread`,
    allCaughtUp:       'All caught up',
    markAllRead:       'Mark all read',
    live:              'Live',
    offline:           'Offline',
    liveChip:          'LIVE',
    noNotifications:   "All caught up!",
    noNotificationsSub:"No new notifications. We'll notify you when something arrives.",
    errorTitle:        'Something went wrong',
    errorSub:          "We couldn't load your notifications. Please try again.",
    processError:      'Failed to process notifications',
    fetchError:        'Failed to fetch notifications',
    networkError:      'Network error. Please check your connection.',
    justNow:           'Just now',
    minutesAgo:        (m: number) => `${m}m`,
    hoursAgo:          (h: number) => `${h}h`,
    daysAgo:           (d: number) => `${d}d`,
  },

  // ─── Orders Screen ────────────────────────────────────────────────────────
  orders: {
    screenTitle:       'ORDERS',

    // Tabs
    tabActive:         'Active',
    tabAvailable:      'Available',
    tabDone:           'Done',

    // Section headers
    sectionOnTheWay:   'On The Way',
    sectionAssigned:   'Assigned / Waiting',
    sectionAvailable:  'Available Orders',

    // Stats
    statTotalFees:     'Total Fees',
    statAvgRating:     'Avg Rating',
    statAvgTime:       'Avg Time',

    // Chips in header
    activeChip:        (n: number) => `${n} active`,
    doneChip:          (n: number) => `${n} done`,

    // Order card
    items:             (n: number) => `${n} items`,
    noAddress:         'No address',
    noRatingYet:       'No rating yet',
    ratingOut:         '/5',
    deliveredOn:       (date: string) => `Delivered ${date}`,
    deliveryFeeLabel:  'Delivery Fee',
    itemsPriceLabel: 'Items',
    totalLabel: 'Total',
    paid:              'Paid',
    cashOnDelivery:    'Cash on Delivery',

    // Action buttons
    accept:            'Accept',
    pickUp:            'Pick Up',
    delivered:         'Delivered',
    customerBtn:       'Customer',
    restaurantBtn:     'Restaurant',
    openInMaps:        'Open in Maps',

    // Status badges
    statusDelivered:   'Delivered',
    statusOnRoad:      'On Road',
    statusAssigned:    'Assigned',
    statusPreparing:   'Preparing',
    statusCancelled:   'Cancelled',
    statusAccepted:    'Accepted',
    statusPending:     'Pending',
    statusUnknown:     'Unknown',

    // Status messages (bottom of card)
    msgReadyPickUp:    'Order is ready. You can pick it up now.',
    msgPreparing:      'Restaurant is preparing your order…',
    msgWaiting:        'Order assigned to you. Waiting for restaurant readiness.',
    msgPickedUp:       'Order picked up. Deliver it to the customer.',

    // Empty states
    emptyActive:       'No active orders',
    emptyActiveSub:    'Orders assigned to you will appear here',
    emptyAvailable:    'No available orders',
    emptyAvailableSub: 'New orders will appear here',
    emptyDone:         'No delivered orders',
    emptyDoneSub:      'Completed deliveries will appear here',

    // Alerts
    alertCallTitle:    'Call Customer',
    alertCallMsg:      (phone: string) => `Call ${phone}?`,
    alertCallBtn:      'Call',
    alertActiveOrderTitle: 'Active Order In Progress',
    alertActiveOrderMsg: 'You must complete your current delivery before accepting a new order.',
    alertCancelBtn: 'Cancel',
    alertCallError:    'Calling is not supported on this device',
    alertCallFailed:   'Failed to open dialer',
    alertNoLocation:   'No Location',
    alertNoLocationMsg:'Delivery address is not available',
    alertNoRestaurant: 'Restaurant location is not available',
    alertNoRestCoords: 'Restaurant coordinates not available',
    alertOrderAssigned:'Order Assigned',
    alertOrderAssignedMsg: 'Order has been assigned to you. Go to the restaurant first.',
    alertOrderAcceptError: 'Failed to accept order',
    alertPickUpSuccess:'Order marked as picked up!',
    alertDeliveredSuccess: 'Order marked as delivered!',
    alertFetchError:   'Failed to fetch orders. Please check your connection.',
    alertUpdateError:  'Failed to update order status',

    // Map
    mapDeliveryTitle:  'Delivery Location',
    mapRestaurantTitle:'Restaurant Location',
    mapRestaurantOrder:(num: string) => `Order #${num}`,
  },

  // ─── Profile Screen ───────────────────────────────────────────────────────
  profile: {
    screenTitle:       'DRIVER CONSOLE',
    editTitle:         'EDIT PROFILE',
    eyebrow:           'ZESTY DRIVER',

    // Status
    active:            'ACTIVE',
    offline:           'OFFLINE',
    idLabel:           (id: number) => `ID #${id}`,

    // Stats
    statEarnings:      'Earnings',
    statDeliveries:    'Deliveries',
    statRating:        'Rating',

    // Sections
    sectionPersonal:   'Personal Information',
    sectionVehicle:    'Vehicle Information',
    sectionVerification:'Verification',
    sectionLocation:   'Current Location',
    sectionLanguage:   'Language',

    // Info row labels
    labelFullName:     'Full Name',
    labelEmail:        'Email Address',
    labelPhone:        'Phone Number',
    labelVehicleType:  'Vehicle Type',
    labelLicense:      'License / Plate',

    // Placeholders
    placeholderName:   'Enter full name',
    placeholderEmail:  'Enter email address',
    placeholderPhone:  'Enter phone number',
    placeholderLicense:'Enter license / plate',

    // Verification
    verDocuments:      'Documents',
    verIdentity:       'Identity',
    verVerified:       'Verified',
    verPending:        'Pending',
    verMissing:        'Missing',

    // Location
    locUpdated:        (time: string) => `Updated ${time}`,
    locNever:          'Never',

    // Actions
    viewDocuments:     'View Documents',
    changePassword:    'Change Password',
    logout:            'Logout',

    // Modals
    avatarModalTitle:  'Change Profile Photo',
    takePhoto:         'Take Photo',
    chooseLibrary:     'Choose from Library',
    removePhoto:       'Remove Photo',
    removePhotoTitle:  'Remove Photo',
    removePhotoConfirm:'Are you sure you want to remove your profile photo?',
    removeBtn:         'Remove',

    // Language selector
    languageLabel:     'App Language',
    langEnglish:       'English',
    langArabic:        'Arabic (عربي)',

    // Alerts
    alertLogoutTitle:  'Logout',
    alertLogoutMsg:    'Are you sure you want to logout?',
    alertLogoutBtn:    'Logout',
    alertSaveSuccess:  'Profile updated successfully!',
    alertSaveFail:     'Failed to update profile',
    alertCameraPermission:'Camera permission is required to take a photo.',
    alertLibraryPermission:'Photo library permission is required.',
    alertPickImageFail:'Failed to pick image',
    alertPickImageTitle:'Error',
    alertSomethingWrong:'Something went wrong',
    alertPermissionDenied:'Permission Denied',
    alertDocumentsMsg: 'Documents view',
    alertPasswordMsg:  'Change password',
    alertFetchFail:    'Failed to load profile',
  },
};

const ar: TranslationSchema = {
  common: {
    appName:          'زيستي درايفر',
    eyebrow:          'زيستي درايفر',
    save:             'حفظ',
    cancel:           'إلغاء',
    confirm:          'تأكيد',
    close:            'إغلاق',
    retry:            'حاول مجدداً',
    refresh:          'تحديث',
    loading:          'جارٍ التحميل…',
    loadingMap:       'جارٍ تحميل الخريطة…',
    ok:               'حسناً',
    yes:              'نعم',
    no:               'لا',
    notAvailable:     'غير متاح',
    version:          'الإصدار 1.0.0  ·  تطبيق شريك التوصيل',
    error:            'خطأ',
    success:          'نجاح',
    networkError:     'خطأ في الشبكة. يرجى التحقق من اتصالك.',
    sessionExpired:   'انتهت الجلسة',
    sessionExpiredMsg:'يرجى تسجيل الدخول مجدداً',
    authRequired:     'المصادقة مطلوبة',
    comingSoon:       'قريباً',
  },

  login: {
    title:             'زيستي درايفر',
    subtitle:          'سجّل دخولك لبدء التوصيل',
    secureLogin:       'دخول آمن',
    driverAuth:        'مصادقة السائق',
    emailLabel:        'البريد الإلكتروني',
    emailPlaceholder:  'driver@example.com',
    passwordLabel:     'كلمة المرور',
    passwordPlaceholder:'أدخل كلمة المرور',
    forgotPassword:    'نسيت كلمة المرور؟',
    signIn:            'تسجيل الدخول',
    needHelp:          'تحتاج مساعدة؟ تواصل مع الدعم',
    missingFields:     'حقول مفقودة',
    missingFieldsMsg:  'يرجى إدخال البريد الإلكتروني وكلمة المرور.',
    loginFailed:       'فشل تسجيل الدخول',
    invalidCredentials:'بيانات اعتماد غير صحيحة.',
    invalidResponse:   'استجابة غير صالحة من الخادم',
    somethingWrong:    'حدث خطأ ما.',
  },

  tabs: {
    home:          'الرئيسية',
    orders:        'الطلبات',
    alerts:        'التنبيهات',
    profile:       'الملف',
  },

  notifications: {
    title:             'الإشعارات',
    screenTitle:       'الإشعارات',
    unreadCount:       (n: number) => `${n} غير مقروء`,
    allCaughtUp:       'كل شيء بخير',
    markAllRead:       'تحديد الكل كمقروء',
    live:              'مباشر',
    offline:           'غير متصل',
    liveChip:          'مباشر',
    noNotifications:   'أنت في الصدارة!',
    noNotificationsSub:'لا توجد إشعارات جديدة. سنخطرك عند وصول أي شيء.',
    errorTitle:        'حدث خطأ ما',
    errorSub:          'تعذّر تحميل الإشعارات. يرجى المحاولة مجدداً.',
    processError:      'فشل في معالجة الإشعارات',
    fetchError:        'فشل في جلب الإشعارات',
    networkError:      'خطأ في الشبكة. يرجى التحقق من اتصالك.',
    justNow:           'الآن',
    minutesAgo:        (m: number) => `${m}د`,
    hoursAgo:          (h: number) => `${h}س`,
    daysAgo:           (d: number) => `${d}ي`,
  },

  orders: {
    screenTitle:       'الطلبات',

    tabActive:         'نشط',
    tabAvailable:      'متاح',
    tabDone:           'منتهي',

    sectionOnTheWay:   'في الطريق',
    sectionAssigned:   'مُعيَّن / انتظار',
    sectionAvailable:  'الطلبات المتاحة',

    statTotalFees:     'إجمالي الرسوم',
    statAvgRating:     'متوسط التقييم',
    statAvgTime:       'متوسط الوقت',

    activeChip:        (n: number) => `${n} نشط`,
    doneChip:          (n: number) => `${n} منتهي`,

    items:             (n: number) => `${n} عناصر`,
    noAddress:         'لا يوجد عنوان',
    noRatingYet:       'لا يوجد تقييم بعد',
    ratingOut:         '/5',
    deliveredOn:       (date: string) => `تم التسليم ${date}`,
    deliveryFeeLabel:  'رسوم التوصيل',
    itemsPriceLabel: 'سعر المنتجات',
    totalLabel: 'الإجمالي',
    paid:              'مدفوع',
    cashOnDelivery:    'الدفع عند الاستلام',

    accept:            'قبول',
    pickUp:            'استلام',
    delivered:         'تم التسليم',
    customerBtn:       'العميل',
    restaurantBtn:     'المطعم',
    openInMaps:        'فتح في الخرائط',

    statusDelivered:   'تم التسليم',
    statusOnRoad:      'في الطريق',
    statusAssigned:    'مُعيَّن',
    statusPreparing:   'قيد التحضير',
    statusCancelled:   'ملغى',
    statusAccepted:    'مقبول',
    statusPending:     'قيد الانتظار',
    statusUnknown:     'غير معروف',

    msgReadyPickUp:    'الطلب جاهز. يمكنك استلامه الآن.',
    msgPreparing:      'المطعم يحضّر طلبك…',
    msgWaiting:        'تم تعيين الطلب لك. انتظر حتى يكون المطعم جاهزاً.',
    msgPickedUp:       'تم استلام الطلب. سلّمه للعميل.',

    emptyActive:       'لا توجد طلبات نشطة',
    emptyActiveSub:    'ستظهر الطلبات المعيّنة لك هنا',
    emptyAvailable:    'لا توجد طلبات متاحة',
    emptyAvailableSub: 'ستظهر الطلبات الجديدة هنا',
    emptyDone:         'لا توجد طلبات مُسلَّمة',
    emptyDoneSub:      'ستظهر التوصيلات المكتملة هنا',

    alertCallTitle:    'الاتصال بالعميل',
    alertCallMsg:      (phone: string) => `الاتصال بـ ${phone}؟`,
    alertCallBtn:      'اتصال',
    alertCancelBtn: 'إلغاء',
    alertActiveOrderTitle: 'طلب نشط قيد التنفيذ',
    alertActiveOrderMsg: 'يجب إتمام التوصيل الحالي قبل قبول طلب جديد.',
    alertCallError:    'الاتصال غير مدعوم على هذا الجهاز',
    alertCallFailed:   'فشل في فتح برنامج الاتصال',
    alertNoLocation:   'لا يوجد موقع',
    alertNoLocationMsg:'عنوان التسليم غير متاح',
    alertNoRestaurant: 'موقع المطعم غير متاح',
    alertNoRestCoords: 'إحداثيات المطعم غير متاحة',
    alertOrderAssigned:'تم تعيين الطلب',
    alertOrderAssignedMsg: 'تم تعيين الطلب لك. توجه إلى المطعم أولاً.',
    alertOrderAcceptError: 'فشل في قبول الطلب',
    alertPickUpSuccess:'تم تحديد الطلب كمستلَم!',
    alertDeliveredSuccess: 'تم تحديد الطلب كمُسلَّم!',
    alertFetchError:   'فشل في جلب الطلبات. تحقق من اتصالك.',
    alertUpdateError:  'فشل في تحديث حالة الطلب',

    mapDeliveryTitle:  'موقع التسليم',
    mapRestaurantTitle:'موقع المطعم',
    mapRestaurantOrder:(num: string) => `طلب رقم #${num}`,
  },

  profile: {
    screenTitle:       'لوحة السائق',
    editTitle:         'تعديل الملف',
    eyebrow:           'زيستي درايفر',

    active:            'نشط',
    offline:           'غير متصل',
    idLabel:           (id: number) => `رقم التعريف #${id}`,

    statEarnings:      'الأرباح',
    statDeliveries:    'التوصيلات',
    statRating:        'التقييم',

    sectionPersonal:   'المعلومات الشخصية',
    sectionVehicle:    'معلومات المركبة',
    sectionVerification:'التحقق',
    sectionLocation:   'الموقع الحالي',
    sectionLanguage:   'اللغة',

    labelFullName:     'الاسم الكامل',
    labelEmail:        'البريد الإلكتروني',
    labelPhone:        'رقم الهاتف',
    labelVehicleType:  'نوع المركبة',
    labelLicense:      'الرخصة / لوحة الترخيص',

    placeholderName:   'أدخل الاسم الكامل',
    placeholderEmail:  'أدخل البريد الإلكتروني',
    placeholderPhone:  'أدخل رقم الهاتف',
    placeholderLicense:'أدخل الرخصة / لوحة الترخيص',

    verDocuments:      'المستندات',
    verIdentity:       'الهوية',
    verVerified:       'موثّق',
    verPending:        'قيد الانتظار',
    verMissing:        'مفقود',

    locUpdated:        (time: string) => `آخر تحديث ${time}`,
    locNever:          'أبداً',

    viewDocuments:     'عرض المستندات',
    changePassword:    'تغيير كلمة المرور',
    logout:            'تسجيل الخروج',

    avatarModalTitle:  'تغيير صورة الملف',
    takePhoto:         'التقاط صورة',
    chooseLibrary:     'اختيار من المكتبة',
    removePhoto:       'إزالة الصورة',
    removePhotoTitle:  'إزالة الصورة',
    removePhotoConfirm:'هل أنت متأكد من إزالة صورة ملفك الشخصي؟',
    removeBtn:         'إزالة',

    languageLabel:     'لغة التطبيق',
    langEnglish:       'English (الإنجليزية)',
    langArabic:        'عربي',

    alertLogoutTitle:  'تسجيل الخروج',
    alertLogoutMsg:    'هل أنت متأكد من تسجيل الخروج؟',
    alertLogoutBtn:    'تسجيل الخروج',
    alertSaveSuccess:  'تم تحديث الملف بنجاح!',
    alertSaveFail:     'فشل في تحديث الملف',
    alertCameraPermission:'مطلوب إذن الكاميرا لالتقاط صورة.',
    alertLibraryPermission:'مطلوب إذن مكتبة الصور.',
    alertPickImageFail:'فشل في اختيار الصورة',
    alertPickImageTitle:'خطأ',
    alertSomethingWrong:'حدث خطأ ما',
    alertPermissionDenied:'الإذن مرفوض',
    alertDocumentsMsg: 'عرض المستندات',
    alertPasswordMsg:  'تغيير كلمة المرور',
    alertFetchFail:    'فشل في تحميل الملف',
  },
};

export const translations: Record<Language, TranslationSchema> = { en, ar };