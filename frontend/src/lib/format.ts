export const money = (amount: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(amount))
export const titleStatus = (status: string) => status.toLowerCase().replace(/_/g, ' ')
