export type Locale = 'en' | 'bn';

export interface TranslationKeys {
  [key: string]: string | TranslationKeys;
}

const en: TranslationKeys = {
  common: {
    appName: 'BornoOCR',
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    rename: 'Rename',
    duplicate: 'Duplicate',
    share: 'Share',
    export: 'Export',
    download: 'Download',
    search: 'Search',
    close: 'Close',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
  },
  nav: {
    dashboard: 'Dashboard',
    editor: 'Editor',
    pricing: 'Pricing',
    admin: 'Admin',
    logout: 'Logout',
  },
  auth: {
    title: 'Sign in to BornoOCR',
    subtitle: 'Enter your email to receive a verification code',
    emailLabel: 'Email address',
    sendOtp: 'Send verification code',
    otpLabel: 'Verification code',
    verifyOtp: 'Verify and sign in',
    nameLabel: 'Your name (optional)',
    backToEmail: 'Back to email',
  },
  dashboard: {
    title: 'My Projects',
    subtitle: 'Manage your PDF projects',
    newProject: 'New Project',
    open: 'Open',
    noProjects: 'No projects yet. Create one to get started.',
    searchPlaceholder: 'Search projects...',
    lastEdited: 'Last edited',
    pages: 'pages',
  },
  editor: {
    undo: 'Undo',
    redo: 'Redo',
    pdfLayout: 'PDF Layout',
    document: 'Document',
    table: 'Table',
    uploadPdf: 'Upload PDF',
    dragDrop: 'Drag and drop a PDF file here, or click to browse',
    page: 'Page',
    of: 'of',
    zoom: 'Zoom',
    fitWidth: 'Fit Width',
    fitPage: 'Fit Page',
    actualSize: 'Actual Size',
    addText: 'Add Text',
    addImage: 'Add Image',
    addShape: 'Add Shape',
    addSignature: 'Add Signature',
    addTable: 'Add Table',
    addAnnotation: 'Add Annotation',
    ocrCorrection: 'OCR Correction',
    exportPdf: 'Export PDF',
    exportDocx: 'Export DOCX',
    exportOdt: 'Export ODT',
    save: 'Save Project',
    share: 'Share Project',
    unsaved: 'Unsaved changes',
    saved: 'Saved',
    saving: 'Saving...',
  },
  inspector: {
    title: 'Properties',
    text: 'Text',
    font: 'Font',
    fontSize: 'Size',
    color: 'Color',
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    alignment: 'Alignment',
    left: 'Left',
    center: 'Center',
    right: 'Right',
    justify: 'Justify',
    position: 'Position',
    size: 'Size',
    lock: 'Lock',
    hide: 'Hide',
    delete: 'Delete element',
  },
  pricing: {
    title: 'Choose your plan',
    subtitle: 'Start free, upgrade when you need more',
    free: 'Free',
    pro: 'Pro',
    business: 'Business',
    perMonth: '/month',
    currentPlan: 'Current Plan',
    upgrade: 'Upgrade',
    downgrade: 'Downgrade',
    bdtToggle: 'BDT (বাংলাদেশ)',
    usdToggle: 'USD (International)',
  },
  admin: {
    title: 'Admin Panel',
    stats: 'Statistics',
    users: 'Users',
    projects: 'Projects',
    payments: 'Payments',
    totalUsers: 'Total Users',
    totalProjects: 'Total Projects',
    totalRevenue: 'Total Revenue',
  },
  ocr: {
    title: 'OCR Correction',
    words: 'Words',
    avgConfidence: 'Avg Confidence',
    lowConfidence: 'Low Confidence',
    heatmap: 'Heatmap',
    lowOnly: 'Low only',
    applyCorrections: 'Apply Corrections',
    reset: 'Reset',
    edit: 'Edit',
  },
  shared: {
    title: 'Shared Project',
    downloadPdf: 'Download PDF',
  },
};

const bn: TranslationKeys = {
  common: {
    appName: 'BornoOCR',
    loading: 'লোড হচ্ছে...',
    save: 'সংরক্ষণ',
    cancel: 'বাতিল',
    delete: 'মুছুন',
    rename: 'নাম পরিবর্তন',
    duplicate: 'কপি',
    share: 'শেয়ার',
    export: 'রপ্তানি',
    download: 'ডাউনলোড',
    search: 'অনুসন্ধান',
    close: 'বন্ধ',
    confirm: 'নিশ্চিত করুন',
    back: 'পিছনে',
    next: 'পরবর্তী',
    previous: 'পূর্ববর্তী',
  },
  nav: {
    dashboard: 'ড্যাশবোর্ড',
    editor: 'সম্পাদক',
    pricing: 'মূল্য',
    admin: 'অ্যাডমিন',
    logout: 'লগআউট',
  },
  auth: {
    title: 'BornoOCR-এ প্রবেশ করুন',
    subtitle: 'যাচাইকরণ কোড পেতে আপনার ইমেইল লিখুন',
    emailLabel: 'ইমেইল ঠিকানা',
    sendOtp: 'যাচাইকরণ কোড পাঠান',
    otpLabel: 'যাচাইকরণ কোড',
    verifyOtp: 'যাচাই করুন এবং সাইন ইন করুন',
    nameLabel: 'আপনার নাম (ঐচ্ছিক)',
    backToEmail: 'ইমেইলে ফিরে যান',
  },
  dashboard: {
    title: 'আমার প্রজেক্ট',
    subtitle: 'আপনার পিডিএফ প্রজেক্ট পরিচালনা করুন',
    newProject: 'নতুন প্রজেক্ট',
    open: 'খুলুন',
    noProjects: 'এখনো কোনো প্রজেক্ট নেই। শুরু করতে একটি তৈরি করুন।',
    searchPlaceholder: 'প্রজেক্ট খুঁজুন...',
    lastEdited: 'সর্বশেষ সম্পাদিত',
    pages: 'পৃষ্ঠা',
  },
  editor: {
    undo: 'পূর্বাবস্থায় ফিরুন',
    redo: 'পুনরায় করুন',
    pdfLayout: 'পিডিএফ লেআউট',
    document: 'ডকুমেন্ট',
    table: 'টেবিল',
    uploadPdf: 'পিডিএফ আপলোড',
    dragDrop: 'এখানে একটি পিডিএফ ফাইল টেনে আনুন অথবা ক্লিক করুন',
    page: 'পৃষ্ঠা',
    of: 'এর মধ্যে',
    zoom: 'জুম',
    fitWidth: 'প্রস্থ অনুযায়ী',
    fitPage: 'পৃষ্ঠা অনুযায়ী',
    actualSize: 'প্রকৃত আকার',
    addText: 'টেক্সট যোগ করুন',
    addImage: 'ছবি যোগ করুন',
    addShape: 'আকৃতি যোগ করুন',
    addSignature: 'স্বাক্ষর যোগ করুন',
    addTable: 'টেবিল যোগ করুন',
    addAnnotation: 'টীকা যোগ করুন',
    ocrCorrection: 'ওসিআর সংশোধন',
    exportPdf: 'পিডিএফ রপ্তানি',
    exportDocx: 'ডকস রপ্তানি',
    exportOdt: 'ওডিটি রপ্তানি',
    save: 'প্রজেক্ট সংরক্ষণ',
    share: 'প্রজেক্ট শেয়ার',
    unsaved: 'অসংরক্ষিত পরিবর্তন',
    saved: 'সংরক্ষিত',
    saving: 'সংরক্ষণ হচ্ছে...',
  },
  inspector: {
    title: 'বৈশিষ্ট্য',
    text: 'টেক্সট',
    font: 'ফন্ট',
    fontSize: 'আকার',
    color: 'রঙ',
    bold: 'বোল্ড',
    italic: 'ইটালিক',
    underline: 'আন্ডারলাইন',
    alignment: 'প্রান্তিককরণ',
    left: 'বাম',
    center: 'কেন্দ্র',
    right: 'ডান',
    justify: 'উভয় প্রান্ত',
    position: 'অবস্থান',
    size: 'আকার',
    lock: 'লক',
    hide: 'লুকান',
    delete: 'উপাদান মুছুন',
  },
  pricing: {
    title: 'আপনার প্ল্যান নির্বাচন করুন',
    subtitle: 'ফ্রিতে শুরু করুন, প্রয়োজনে আপগ্রেড করুন',
    free: 'ফ্রি',
    pro: 'প্রো',
    business: 'বিজনেস',
    perMonth: '/মাস',
    currentPlan: 'বর্তমান প্ল্যান',
    upgrade: 'আপগ্রেড',
    downgrade: 'ডাউনগ্রেড',
    bdtToggle: 'টাকা (বাংলাদেশ)',
    usdToggle: 'ডলার (আন্তর্জাতিক)',
  },
  admin: {
    title: 'অ্যাডমিন প্যানেল',
    stats: 'পরিসংখ্যান',
    users: 'ব্যবহারকারী',
    projects: 'প্রজেক্ট',
    payments: 'পেমেন্ট',
    totalUsers: 'মোট ব্যবহারকারী',
    totalProjects: 'মোট প্রজেক্ট',
    totalRevenue: 'মোট আয়',
  },
  ocr: {
    title: 'ওসিআর সংশোধন',
    words: 'শব্দ',
    avgConfidence: 'গড় নির্ভরযোগ্যতা',
    lowConfidence: 'কম নির্ভরযোগ্যতা',
    heatmap: 'হিটম্যাপ',
    lowOnly: 'শুধু কম',
    applyCorrections: 'সংশোধন প্রয়োগ করুন',
    reset: 'রিসেট',
    edit: 'সম্পাদনা',
  },
  shared: {
    title: 'শেয়ার করা প্রজেক্ট',
    downloadPdf: 'পিডিএফ ডাউনলোড',
  },
};

const translations: Record<Locale, TranslationKeys> = { en, bn };

function getNestedValue(obj: TranslationKeys, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof current === 'string' ? current : path;
}

let currentLocale: Locale = 'en';

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  localStorage.setItem('docflow_locale', locale);
  document.documentElement.lang = locale;
  window.dispatchEvent(new CustomEvent('localechange'));
}

export function initLocale(): void {
  const stored = localStorage.getItem('docflow_locale') as Locale | null;
  if (stored && (stored === 'en' || stored === 'bn')) {
    currentLocale = stored;
  } else {
    const browserLang = navigator.language.toLowerCase();
    currentLocale = browserLang.startsWith('bn') ? 'bn' : 'en';
  }
  document.documentElement.lang = currentLocale;
}

export function t(key: string): string {
  return getNestedValue(translations[currentLocale], key);
}
