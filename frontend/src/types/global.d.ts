type ArenaUser = {
  id: number;
  username: string;
  created_at: string;
  updated_at: string;
};

type AuthenticationResponse = {
  access_token: string;
  token_type: "bearer";
  user: ArenaUser;
};

type AuthMode = "login" | "register";
