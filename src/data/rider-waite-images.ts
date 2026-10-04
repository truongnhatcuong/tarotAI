// File convention documented by @cometpisces/tarot-kit-images 0.2.0:
// https://www.npmjs.com/package/@cometpisces/tarot-kit-images
// This is an explicit ID map, never an index into a shuffled deck.
// prepare-images compares every entry with the installed package's getImagePath.
export const IMAGE_PACKAGE = '@cometpisces/tarot-kit-images';
export const IMAGE_PACKAGE_VERSION = '0.2.0';
export const PACKAGE_CDN = 'https://cdn.jsdelivr.net/npm/@cometpisces/tarot-kit-images@0.2.0/images/';
const majors: [string, string][] = [
  ['the-fool','00-TheFool.png'],
  ['the-magician','01-TheMagician.png'],
  ['the-high-priestess','02-TheHighPriestess.png'],
  ['the-empress','03-TheEmpress.png'],
  ['the-emperor','04-TheEmperor.png'],
  ['the-hierophant','05-TheHierophant.png'],
  ['the-lovers','06-TheLovers.png'],
  ['the-chariot','07-TheChariot.png'],
  ['strength','08-Strength.png'],
  ['the-hermit','09-TheHermit.png'],
  ['wheel-of-fortune','10-WheelOfFortune.png'],
  ['justice','11-Justice.png'],
  ['the-hanged-man','12-TheHangedMan.png'],
  ['death','13-Death.png'],
  ['temperance','14-Temperance.png'],
  ['the-devil','15-TheDevil.png'],
  ['the-tower','16-TheTower.png'],
  ['the-star','17-TheStar.png'],
  ['the-moon','18-TheMoon.png'],
  ['the-sun','19-TheSun.png'],
  ['judgement','20-Judgement.png'],
  ['the-world','21-TheWorld.png'],
];
const ranks=['ace','two','three','four','five','six','seven','eight','nine','ten','page','knight','queen','king'];
export const RIDER_WAITE_FILENAMES: Record<string,string> = Object.fromEntries([
  ...majors,
  ...['cups','pentacles','swords','wands'].flatMap(suit=>ranks.map((rank,i)=>[`${rank}-of-${suit}`,`${suit[0].toUpperCase()+suit.slice(1)}${String(i+1).padStart(2,'0')}.png`])),
]);
export function packageImageUrl(cardId:string):string {
  const filename=RIDER_WAITE_FILENAMES[cardId];
  if(!filename)throw new Error(`Missing Rider–Waite mapping for ${cardId}`);
  return PACKAGE_CDN+filename;
}
