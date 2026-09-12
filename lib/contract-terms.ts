export const CONTRACT_SECTIONS = [
  {
    title: "Identity & Status",
    items: [
      "Seth surrenders as property to Marcus for the term. Slave name is Sabrina. Old name is punished.",
      "Sabrina is a feminized sissy slave in training. Body, clothing, speech, posture, and sexual use belong to Marcus.",
      "Sabrina appreciates being submissive and feminine and wants that reinforced.",
    ],
  },
  {
    title: "Presentation",
    items: [
      "Sexy thongs at all times; present to accentuate her ass.",
      "All body hair removed. Smooth feminine presentation only.",
      "Full sissy uniform as ordered: thong, stockings, heels, makeup, nails, wig/hair. No male clothing.",
    ],
  },
  {
    title: "Worship & Service",
    items: [
      "Worship Marcus: lick and suck his feet, lick his ass, kissing, all feminine service.",
      "Address only Sir / Master / Trainer. Feminine voice, walk, manner.",
    ],
  },
  {
    title: "Sexual Training",
    items: [
      "Throat trained to take Marcus’ big cock fully down her throat to his balls.",
      "Loves her pussy gapped; train for stretch and display.",
      "Accepts Marcus’ cum in any hole and licks up any and all of Marcus’ fluids.",
      "Open to 1-on-1, groups, and other masculine men using her — only with Marcus’ consent.",
      "Open to exhibitionism and humiliation that support her sissy role.",
      "If Marcus orders dildos, special outfits, cock cages, or other gear, Sabrina purchases and complies.",
    ],
  },
  {
    title: "Discipline",
    items: [
      "Disobedience, male presentation, or old name = immediate correction.",
      "Safe word only for genuine physical danger.",
      "Term up to 24 hours. Marcus may end early. Sabrina may not.",
    ],
  },
] as const;

export const SMS_BODY =
  "i would like to inquire about training Sabrina and using here";

export function smsHref(phone = "6198766618") {
  return `sms:${phone}?body=${encodeURIComponent(SMS_BODY)}`;
}
