export type Category = 'Todos' | 'Grupo Especial' | 'Série Ouro' | 'Experiências'
export type Option = { name: string; price: number; note: string }
export type Product = {
  id: number
  title: string
  category: Exclude<Category, 'Todos'> | 'Rio City Tour'
  kind: 'carnaval' | 'city'
  date: string
  dateLabel: string
  venue: string
  description: string
  image: string
  imageAlt: string
  options: Option[]
  badge?: string
  badgeTone?: 'yellow' | 'red' | 'blue'
  originalPrice?: number
}

export const carnivalProducts: Product[] = [
  { id: 1, title: 'Grupo Especial · Domingo', category: 'Grupo Especial', kind: 'carnaval', date: '2027-02-07', dateLabel: 'DOM, 7 FEV 2027', venue: 'Sambódromo · Marquês de Sapucaí', description: 'A primeira noite do maior desfile do mundo.', image: '/images/avenida-noturna.webp', imageAlt: 'Vista aérea de um desfile iluminado na avenida', options: [{ name: 'Arquibancada', price: 270, note: 'A energia da avenida' }, { name: 'Frisa', price: 790, note: 'Mais perto do desfile' }, { name: 'Camarote', price: 1490, note: 'Vista e conforto' }], badge: 'Mais procurado', badgeTone: 'yellow' },
  { id: 2, title: 'Série Ouro · Sexta', category: 'Série Ouro', kind: 'carnaval', date: '2027-02-05', dateLabel: 'SEX, 5 FEV 2027', venue: 'Sambódromo · Marquês de Sapucaí', description: 'Ritmo, tradição e novas histórias na avenida.', image: '/images/samba-percussao.webp', imageAlt: 'Ritmista de escola de samba em figurino vermelho e dourado', options: [{ name: 'Arquibancada', price: 120, note: 'A vibração do desfile' }, { name: 'Frisa', price: 490, note: 'Perto da bateria' }], badge: '20% OFF · exemplo', badgeTone: 'red', originalPrice: 150 },
  { id: 3, title: 'Camarote da Avenida', category: 'Experiências', kind: 'carnaval', date: '2027-02-06', dateLabel: 'SÁB, 6 FEV 2027', venue: 'Sambódromo · Marquês de Sapucaí', description: 'Uma perspectiva especial para viver cada detalhe.', image: '/images/camarote-vista.webp', imageAlt: 'Lounge elegante iluminado com vista para a avenida', options: [{ name: 'Camarote', price: 490, note: 'Vista privilegiada' }, { name: 'Camarote premium', price: 890, note: 'Espaço e conforto extra' }], badge: 'Oferta · exemplo', badgeTone: 'blue', originalPrice: 590 },
  { id: 4, title: 'Série Ouro · Sábado', category: 'Série Ouro', kind: 'carnaval', date: '2027-02-06', dateLabel: 'SÁB, 6 FEV 2027', venue: 'Sambódromo · Marquês de Sapucaí', description: 'O espetáculo continua em uma noite vibrante.', image: '/images/bloco-de-rua.webp', imageAlt: 'Percussionistas em uma celebração colorida no Rio', options: [{ name: 'Arquibancada', price: 140, note: 'A energia da avenida' }, { name: 'Frisa', price: 520, note: 'Mais perto do desfile' }], badge: 'Novidade', badgeTone: 'blue' },
  { id: 5, title: 'Grupo Especial · Segunda', category: 'Grupo Especial', kind: 'carnaval', date: '2027-02-08', dateLabel: 'SEG, 8 FEV 2027', venue: 'Sambódromo · Marquês de Sapucaí', description: 'Grandes alegorias em uma noite inesquecível.', image: '/images/alegoria-dourada.webp', imageAlt: 'Alegoria dourada com esculturas de aves tropicais', options: [{ name: 'Arquibancada', price: 270, note: 'A energia da avenida' }, { name: 'Frisa', price: 790, note: 'Mais perto do desfile' }, { name: 'Camarote', price: 1490, note: 'Vista e conforto' }], badge: 'Destaque', badgeTone: 'yellow' },
  { id: 6, title: 'Frisa na Sapucaí', category: 'Experiências', kind: 'carnaval', date: '2027-02-08', dateLabel: 'SEG, 8 FEV 2027', venue: 'Sambódromo · Marquês de Sapucaí', description: 'Sinta a avenida de um lugar ainda mais próximo.', image: '/images/arquibancada-fogos.webp', imageAlt: 'Público acompanha fogos de artifício sobre a avenida', options: [{ name: 'Frisa', price: 790, note: 'Mais perto do desfile' }, { name: 'Frisa premium', price: 1090, note: 'Vista central da avenida' }] },
]

export const cityProducts: Product[] = [
  { id: 7, title: 'Santa Teresa de perto', category: 'Rio City Tour', kind: 'city', date: '', dateLabel: 'DATAS A DEFINIR', venue: 'Santa Teresa · Rio de Janeiro', description: 'Ruas históricas, arte e a alma carioca.', image: '/images/santa-teresa-bonde.webp', imageAlt: 'Bonde amarelo atravessa uma rua histórica de Santa Teresa', options: [{ name: 'Experiência compartilhada', price: 180, note: 'Valor ilustrativo por pessoa' }, { name: 'Experiência privativa', price: 390, note: 'Valor ilustrativo por pessoa' }], badge: 'Oferta · exemplo', badgeTone: 'blue', originalPrice: 220 },
  { id: 8, title: 'Pão de Açúcar ao entardecer', category: 'Rio City Tour', kind: 'city', date: '', dateLabel: 'DATAS A DEFINIR', venue: 'Urca · Rio de Janeiro', description: 'O pôr do sol visto de um dos ícones do Rio.', image: '/images/pao-de-acucar.webp', imageAlt: 'Bondinho diante do Pão de Açúcar no pôr do sol', options: [{ name: 'Experiência compartilhada', price: 220, note: 'Valor ilustrativo por pessoa' }, { name: 'Experiência privativa', price: 460, note: 'Valor ilustrativo por pessoa' }], badge: 'Mais desejado', badgeTone: 'yellow' },
  { id: 9, title: 'Rio visto do mar', category: 'Rio City Tour', kind: 'city', date: '', dateLabel: 'DATAS A DEFINIR', venue: 'Baía de Guanabara · Rio de Janeiro', description: 'Paisagens da cidade por um ângulo especial.', image: '/images/rio-pelo-mar.webp', imageAlt: 'Barco navega pela baía com montanhas do Rio ao fundo', options: [{ name: 'Passeio compartilhado', price: 320, note: 'Valor ilustrativo por pessoa' }, { name: 'Passeio privativo', price: 690, note: 'Valor ilustrativo por pessoa' }], badge: 'Novidade', badgeTone: 'blue' },
]

export const categories: { name: Exclude<Category, 'Todos'>; image: string; description: string }[] = [
  { name: 'Grupo Especial', image: '/images/avenida-noturna.webp', description: 'O grande espetáculo' },
  { name: 'Série Ouro', image: '/images/samba-percussao.webp', description: 'A força da tradição' },
  { name: 'Experiências', image: '/images/camarote-vista.webp', description: 'Outro jeito de viver' },
]

export const money = (amount: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(amount)
