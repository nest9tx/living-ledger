import supabase from "./supabase";

// Categories
export async function fetchCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}

export async function seedDefaultCategories() {
  const defaultCategories = [
    { name: "Skills & Learning", icon: "📚" },
    { name: "Creative Work", icon: "🎨" },
    { name: "Emotional Support", icon: "💙" },
    { name: "Research & Writing", icon: "✍️" },
    { name: "Organization & Planning", icon: "📋" },
    { name: "Tech & Code", icon: "💻" },
    { name: "Healing & Wellness", icon: "🧘" },
    { name: "Community & Activism", icon: "🌍" },
  ];

  for (const category of defaultCategories) {
    const { error } = await supabase
      .from("categories")
      .upsert([category], { onConflict: "name" });
    if (error) console.error("Error seeding category:", error);
  }
}

// Requests
export async function createRequest(
  title: string,
  description: string,
  categoryId: number,
  budgetCredits: number
) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("requests")
    .insert([{ user_id: user.user.id, title, description, category_id: categoryId, budget_credits: budgetCredits }])
    .select();

  if (error) throw error;
  return data;
}

export async function fetchRequests() {
  const { data, error } = await supabase
    .from("requests")
    .select(
      `id, 
       title, 
       description, 
       status, 
       budget_credits,
       created_at, 
       user_id, 
       category_id, 
       categories:category_id(name, icon), 
       profiles:user_id(username)`
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// Offers
export async function createOffer(
  title: string,
  description: string,
  categoryId: number,
  priceCredits: number
) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("offers")
    .insert([
      {
        user_id: user.user.id,
        title,
        description,
        category_id: categoryId,
        price_credits: priceCredits,
      },
    ])
    .select();

  if (error) throw error;
  return data;
}

export async function fetchOffers() {
  const { data, error } = await supabase
    .from("offers")
    .select(
      `id, 
       title, 
       description, 
       price_credits,
       created_at, 
       user_id, 
       category_id, 
       categories:category_id(name, icon), 
       profiles:user_id(username)`
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// Credit balance & transactions
export async function getUserCredits() {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Not authenticated");

  // For MVP, store credits in a simple way.
  // You may want to migrate this to a dedicated credits_balance table later.
  const { data: transactions, error: txError } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.user.id)
    .order("created_at", { ascending: false });

  if (txError) throw txError;

  const balance = transactions?.reduce((sum, tx) => sum + (tx.amount || 0), 0) ?? 0;
  return { balance, transactions };
}

export async function recordTransaction(
  amount: number,
  description: string
) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("transactions")
    .insert([
      {
        user_id: user.user.id,
        amount,
        description,
      },
    ])
    .select();

  if (error) throw error;
  return data;
}
