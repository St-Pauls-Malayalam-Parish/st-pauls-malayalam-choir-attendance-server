export const parishMembers = [
  { name: 'Angel Benny', present: 15, absent: 5 },
  { name: 'Anil Cherian', present: 11, absent: 9 },
  { name: 'Angelina Liju', present: 11, absent: 9 },
  { name: 'Ann Catherine', present: 12, absent: 8 },
  { name: 'Anna Chandy', present: 1, absent: 19 },
  { name: 'Annie Mathew', present: 19, absent: 1 },
  { name: 'Ashwin George', present: 7, absent: 13 },
  { name: 'Chandy Thomas', present: 0, absent: 20 },
  { name: 'Deepa Varghese', present: 6, absent: 14 },
  { name: 'Evan Thomas', present: 7, absent: 13 },
  { name: 'Gianna George', present: 12, absent: 8 },
  { name: 'Honey Thomas', present: 2, absent: 18 },
  { name: 'Jeku Kurien', present: 14, absent: 6 },
  { name: 'Jeff Jones', present: 13, absent: 7 },
  { name: 'Jennifer Mathew', present: 16, absent: 4 },
  { name: 'Joanna Mathew', present: 7, absent: 13 },
  { name: 'Juby Thampy', present: 14, absent: 6 },
  { name: 'Juby George', present: 0, absent: 20 },
  { name: 'Judith George', present: 12, absent: 8 },
  { name: 'Kurien George', present: 0, absent: 20 },
  { name: 'Lydia Philip', present: 5, absent: 15 },
  { name: 'Mathew K Tharian', present: 15, absent: 5 },
  { name: 'Melvin John', present: 6, absent: 14 },
  { name: 'Mercy John', present: 5, absent: 15 },
  { name: 'Neena Kurien', present: 15, absent: 5 },
  { name: 'Noah Thomas', present: 0, absent: 20 },
  { name: 'Noel Joseph', present: 17, absent: 3 },
  { name: 'Rigin Oommen', present: 8, absent: 12 },
  { name: 'Ryan Johnson', present: 3, absent: 17 },
  { name: 'Sabin Sam', present: 12, absent: 8 },
  { name: 'Sajini M Chandy', present: 9, absent: 11 },
  { name: 'Sarah Jacob', present: 16, absent: 4 },
  { name: 'Shawn Thomas', present: 0, absent: 20 },
  { name: 'Shibin Shibu', present: 3, absent: 17 },
  { name: 'Shyji Jacob', present: 14, absent: 6 },
  { name: 'Simon Sam', present: 10, absent: 10 },
  { name: 'Steven Philip', present: 0, absent: 20 },
  { name: 'Sudheip Alex', present: 13, absent: 7 },
  { name: 'Susan Jacob', present: 0, absent: 20 },
  { name: 'Thomas K Tharian', present: 15, absent: 5 },
  { name: 'Vincy Jeku', present: 16, absent: 4 },
];

export function emailFromName(name) {
  return `${usernameFromName(name)}@choir.local`;
}

export function usernameFromName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}
