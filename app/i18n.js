// Voice-call and SMS scripts for pump owners, in four languages.
// {id} = pump id, {e} = today's earnings, {m} = month to date, {w} = this week.
export const LANGS = [
  { code: "hi", name: "हिन्दी", voice: "hi-IN" },
  { code: "gu", name: "ગુજરાતી", voice: "gu-IN" },
  { code: "mr", name: "मराठी", voice: "mr-IN" },
  { code: "en", name: "English", voice: "en-IN" },
];

export const SCRIPT = {
  hi: {
    ask: "नमस्ते। क्या आज आप पंप {id} से सिंचाई करेंगे? हाँ के लिए 1 दबाएँ, ना के लिए 2 दबाएँ।",
    yes: "ठीक है। आज पहले आपके खेत को पानी मिलेगा, फिर बची धूप बेची जाएगी।",
    no: "ठीक है। आज आपके पंप की धूप गाँव में बेची जाएगी। शाम को आपकी कमाई बताएँगे।",
    eveIrr: "नमस्ते। आज पंप {id} ने पहले आपके खेत को पानी दिया, फिर बची धूप से ₹{e} कमाए। इस महीने अब तक: ₹{m}।",
    eveSold: "नमस्ते। आज पंप {id} की बची धूप से ₹{e} की कमाई हुई। इस महीने अब तक: ₹{m}।",
    eveNone: "नमस्ते। आज पंप {id} की धूप आपकी सिंचाई में लगी। इस महीने अब तक की कमाई: ₹{m}।",
    week: "बची धूप: इस हफ़्ते पंप {id} की कमाई ₹{w}। रविवार को UPI से आपके खाते में।",
  },
  gu: {
    ask: "નમસ્તે. આજે પંપ {id} પર તમે સિંચાઈ કરશો? હા માટે 1 દબાવો, ના માટે 2 દબાવો.",
    yes: "બરાબર. આજે પહેલાં તમારા ખેતરને પાણી મળશે, પછી બચેલો તડકો વેચાશે.",
    no: "બરાબર. આજે તમારા પંપનો તડકો ગામમાં વેચાશે. સાંજે કમાણી જણાવીશું.",
    eveIrr: "નમસ્તે. આજે પંપ {id} એ પહેલાં તમારા ખેતરને પાણી આપ્યું, પછી બચેલા તડકાથી ₹{e} કમાયા. આ મહિને અત્યાર સુધી: ₹{m}.",
    eveSold: "નમસ્તે. આજે પંપ {id} ના બચેલા તડકાથી ₹{e} ની કમાણી થઈ. આ મહિને અત્યાર સુધી: ₹{m}.",
    eveNone: "નમસ્તે. આજે પંપ {id} નો તડકો તમારી સિંચાઈમાં વપરાયો. આ મહિને અત્યાર સુધીની કમાણી: ₹{m}.",
    week: "બચી ધૂપ: આ અઠવાડિયે પંપ {id} ની કમાણી ₹{w}. રવિવારે UPI થી તમારા ખાતામાં.",
  },
  mr: {
    ask: "नमस्कार. आज तुम्ही पंप {id} ने पाणी देणार आहात का? होय साठी 1 दाबा, नाही साठी 2 दाबा.",
    yes: "ठीक आहे. आज आधी तुमच्या शेताला पाणी मिळेल, मग उरलेलं ऊन विकलं जाईल.",
    no: "ठीक आहे. आज तुमच्या पंपाचं ऊन गावात विकलं जाईल. संध्याकाळी कमाई सांगू.",
    eveIrr: "नमस्कार. आज पंप {id} ने आधी तुमच्या शेताला पाणी दिलं, मग उरलेल्या उन्हातून ₹{e} कमावले. या महिन्यात आतापर्यंत: ₹{m}.",
    eveSold: "नमस्कार. आज पंप {id} च्या उरलेल्या उन्हातून ₹{e} ची कमाई झाली. या महिन्यात आतापर्यंत: ₹{m}.",
    eveNone: "नमस्कार. आज पंप {id} चं ऊन तुमच्या सिंचनासाठी वापरलं. या महिन्यात आतापर्यंतची कमाई: ₹{m}.",
    week: "बची धूप: या आठवड्यात पंप {id} ची कमाई ₹{w}. रविवारी UPI ने तुमच्या खात्यात.",
  },
  en: {
    ask: "Namaste. Will you irrigate from pump {id} today? Press 1 for yes, 2 for no.",
    yes: "Thank you. Your field gets water first today; only the leftover sun will be sold.",
    no: "Thank you. Your pump's sun will be sold in the village today. We will call this evening with your earnings.",
    eveIrr: "Namaste. Today pump {id} watered your field first, then earned ₹{e} from the leftover sun. This month so far: ₹{m}.",
    eveSold: "Namaste. Today pump {id}'s leftover sun earned ₹{e}. This month so far: ₹{m}.",
    eveNone: "Namaste. Today pump {id}'s sun went to your own irrigation. Earned this month so far: ₹{m}.",
    week: "Bachi Dhoop: pump {id} earned ₹{w} this week. Paid to your bank by UPI on Sunday.",
  },
};

export function fill(t, v) { return t.replace(/\{(\w+)\}/g, (_, k) => (k in v ? v[k] : "")); }
