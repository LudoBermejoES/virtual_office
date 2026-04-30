export interface TestUser {
  email: string;
  role: "admin" | "member" | "external";
}

export interface TestDesk {
  id: number;
  label: string;
  x: number;
  y: number;
}

export interface TestOffice {
  officeId: number;
  desks: TestDesk[];
}
