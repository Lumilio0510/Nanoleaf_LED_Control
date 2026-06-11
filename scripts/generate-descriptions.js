/**
 * Generate detailed visual descriptions for all design files.
 * Uses name-based visual mapping + layout analysis.
 * Run with: node scripts/generate-descriptions.js
 */
const { readFileSync, writeFileSync, readdirSync } = require('fs')
const { join, resolve } = require('path')

const designsDir = resolve(process.cwd(), 'designs')

const TYPE_NAMES = {
  triangle: '全等正三角形',
  hexagon: '正六边形',
  'mini-triangle': '小正三角形',
}

/**
 * Map design names to specific visual descriptions.
 * These are curated descriptions that explain what the pattern looks like.
 */
const VISUAL_MAP = {
  '极夜星坠': (c) => `${c}，整体左右对称，呈横向一字排开的星轨状，中间高两侧低，如星坠长夜`,
  '猫头': (c) => `${c}，整体呈圆形猫脸布局，上方有猫耳尖角、两侧脸颊饱满，结构层次丰富`,
  '光棱誓约': (c) => `${c}，横向对称排布，中间密集、两端渐疏，呈光棱折射状发散`,
  '羊羊得意': (c) => `${c}，左右对称排列，中部隆起、两端收尖，呈羊首或角形轮廓`,
  '情侣喵喵': (c) => `${c}，左右各形成一组猫形图案，中间相连，呈双猫依偎的情侣造型`,
  '钻石': (c) => `${c}，纵向对称堆叠，从上到下收拢再展开，呈钻石切割般的菱形轮廓`,
  '黑域锋芒': (c) => `${c}，横向一字展开，中间密集、两端尖锐突出，呈锋芒放射状`,
  '云翼巡天': (c) => `${c}，左右对称展开如宏大云翼，气势磅礴，颇具视觉张力`,
  '库米酱': (c) => `${c}，左右对称排列，呈卡通风格面部轮廓，上方有圆润耳部特征`,
  '和弦光阶': (c) => `${c}，阶梯状横向排布，高低错落如音乐和弦的波形光阶`,
  '爱心': (c) => `${c}，左右对称排布，呈标准爱心形状，上方内凹、下方收尖`,
  '猫耳1': (c) => `${c}，横向一字排列，两端三角向上翘起形成猫耳，中部平缓`,
  '粼粼波光': (c) => `${c}，横向波浪状排列，大小三角交错如水面粼粼波光`,
  '怦然翼动': (c) => `${c}，横向对称展开，中间收束、两翼张开，呈振翅欲飞之态`,
  '灵动猫耳2.0': (c) => `${c}，对称拼接，上方猫耳高耸灵动，下方脸颊圆润饱满`,
  '萌趣米妮': (c) => `${c}，左右对称排布，顶部有圆形蝴蝶结特征，整体呈米妮卡通轮廓`,
  '魔法权杖': (c) => `${c}，纵向排列，顶部展开、中部修长、底部收束，呈权杖造型`,
  '星环引力': (c) => `${c}，横向弧形排布，对称展开如星环或引力波弧线`,
  '算法测试': (c) => `${c}，横向一字排开，均匀等距排列`,
}

function buildTypeString(panels) {
  const counts = { triangle: 0, hexagon: 0, 'mini-triangle': 0 }
  panels.forEach(p => { counts[p.type] = (counts[p.type] || 0) + 1 })
  const total = panels.length
  const hasMultiple = Object.values(counts).filter(c => c > 0).length > 1

  const parts = []
  if (counts.triangle > 0) parts.push(`${counts.triangle} 块${TYPE_NAMES.triangle}`)
  if (counts.hexagon > 0) parts.push(`${counts.hexagon} 块${TYPE_NAMES.hexagon}`)
  if (counts['mini-triangle'] > 0) parts.push(`${counts['mini-triangle']} 块${TYPE_NAMES['mini-triangle']}`)

  const composition = hasMultiple
    ? `图案由 ${parts.join('、')} 共 ${total} 块面板拼接而成`
    : `图案由 ${total} 块${TYPE_NAMES[Object.keys(counts).find(k => counts[k] > 0)]}拼接而成`

  // Colors
  const colors = [...new Set(panels.map(p => p.color))].filter(c => c !== '#cccccc' && c !== '#ffffff')
  let colorStr = ''
  if (colors.length >= 2) {
    colorStr = `，配色以 ${colors.slice(0, 3).join('、')} 为主`
  } else if (colors.length === 1) {
    colorStr = `，配色以 ${colors[0]} 为主`
  }

  return { composition, total, colorStr, counts }
}

// Main
const files = readdirSync(designsDir).filter(f => f.endsWith('.json'))
let updated = 0

for (const file of files) {
  const fp = join(designsDir, file)
  const design = JSON.parse(readFileSync(fp, 'utf-8'))
  if (!design.panels || !Array.isArray(design.panels)) continue

  const { composition, total, colorStr } = buildTypeString(design.panels)
  const mapper = VISUAL_MAP[design.name]

  if (mapper) {
    design.description = mapper(composition) + colorStr + '。'
  } else {
    continue // skip if no specific mapping
  }

  writeFileSync(fp, JSON.stringify(design, null, 2), 'utf-8')
  updated++
  console.log(`  ${design.name}: ${design.description.slice(0, 80)}…`)
}

console.log(`\nDone. ${updated} designs updated.`)
