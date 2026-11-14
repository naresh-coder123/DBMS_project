export const food = {
  hero: 'photo-1547592180-85f173990554',
  indian: 'photo-1567188040759-fb8a883dc6d8',
  pizza: 'photo-1574071318508-1cdbab80d002',
  noodles: 'photo-1569718212165-3a8278d5f624',
}
export const photo = (id: string, width: number) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`
export const imageFor = (name: string) => /pizza/i.test(name) ? food.pizza : /wok|noodle/i.test(name) ? food.noodles : food.indian
