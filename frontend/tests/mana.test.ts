import { describe, expect, it } from 'vitest'
import { parseManaString, resolveManaSymbol } from '../app/utils/mana'

describe('parseManaString', () => {
  it('parses a simple generic + colored cost', () => {
    expect(parseManaString('{6}{U}')).toEqual([
      { type: 'symbol', code: '6' },
      { type: 'symbol', code: 'U' },
    ])
  })

  it('parses repeated symbols', () => {
    expect(parseManaString('{X}{G}{G}')).toEqual([
      { type: 'symbol', code: 'X' },
      { type: 'symbol', code: 'G' },
      { type: 'symbol', code: 'G' },
    ])
  })

  it('parses hybrid and phyrexian symbols', () => {
    expect(parseManaString('{G/W}{2/U}{B/P}')).toEqual([
      { type: 'symbol', code: 'G/W' },
      { type: 'symbol', code: '2/U' },
      { type: 'symbol', code: 'B/P' },
    ])
  })

  it('keeps surrounding text as text segments', () => {
    expect(parseManaString('Ajoutez {T}: piochez une carte.')).toEqual([
      { type: 'text', value: 'Ajoutez ' },
      { type: 'symbol', code: 'T' },
      { type: 'text', value: ': piochez une carte.' },
    ])
  })

  it('preserves newlines inside text segments', () => {
    expect(parseManaString('Vol.\n{T}: ajoutez {C}.')).toEqual([
      { type: 'text', value: 'Vol.\n' },
      { type: 'symbol', code: 'T' },
      { type: 'text', value: ': ajoutez ' },
      { type: 'symbol', code: 'C' },
      { type: 'text', value: '.' },
    ])
  })

  it('returns an empty array for empty input', () => {
    expect(parseManaString('')).toEqual([])
  })

  it('returns pure text when there are no braces', () => {
    expect(parseManaString('Piochez une carte.')).toEqual([{ type: 'text', value: 'Piochez une carte.' }])
  })
})

describe('resolveManaSymbol', () => {
  it('resolves generic numeric symbols as grey discs', () => {
    expect(resolveManaSymbol('6')).toEqual({ modifier: 'generic', label: '6' })
    expect(resolveManaSymbol('0')).toEqual({ modifier: 'generic', label: '0' })
    expect(resolveManaSymbol('20')).toEqual({ modifier: 'generic', label: '20' })
  })

  it('resolves X/Y/Z as generic', () => {
    expect(resolveManaSymbol('X')).toEqual({ modifier: 'generic', label: 'X' })
  })

  it('resolves WUBRG colors', () => {
    expect(resolveManaSymbol('W')).toEqual({ modifier: 'w', label: 'W' })
    expect(resolveManaSymbol('u')).toEqual({ modifier: 'u', label: 'U' })
    expect(resolveManaSymbol('G')).toEqual({ modifier: 'g', label: 'G' })
  })

  it('resolves colorless, snow and tap symbols', () => {
    expect(resolveManaSymbol('C')).toEqual({ modifier: 'c', label: 'C' })
    expect(resolveManaSymbol('S')).toEqual({ modifier: 's', label: 'S' })
    expect(resolveManaSymbol('T')).toEqual({ modifier: 'tap', label: 'T' })
  })

  it('resolves hybrid color/color symbols with a two-color gradient', () => {
    expect(resolveManaSymbol('G/W')).toEqual({
      modifier: 'hybrid',
      label: 'G/W',
      colors: ['var(--mtg-green)', 'var(--mtg-white)'],
    })
  })

  it('resolves generic/color hybrid symbols with a grey + color gradient', () => {
    expect(resolveManaSymbol('2/U')).toEqual({
      modifier: 'hybrid',
      label: '2/U',
      colors: ['#9aa3af', 'var(--mtg-blue)'],
    })
  })

  it('resolves phyrexian symbols with the underlying color as a secondary modifier', () => {
    expect(resolveManaSymbol('B/P')).toEqual({ modifier: 'phyrexian', label: 'P', colorModifier: 'b' })
  })

  it('falls back to a grey disc with the raw text for unknown symbols', () => {
    expect(resolveManaSymbol('???')).toEqual({ modifier: 'unknown', label: '???' })
  })
})
