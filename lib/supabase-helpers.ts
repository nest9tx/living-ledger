import supabase from "./supabase";

// Categories
export async function fetchCategories() {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    
    if (error) {
      console.error("Error fetching categories:", error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.warn("No categories found. Seeding defaults...");
      await seedDefaultCategories();
      // Fetch again after seeding
      const { data: seedData, error: seedError } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      if (seedError) throw seedError;
      return seedData;
    }

    return data;
  } catch (err) {
    console.error("Unexpected error in fetchCategories:", err);
    throw err;
  }
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

  try {
    for (const category of defaultCategories) {
      const { data, error } = await supabase
        .from("categories")
        .upsert([category], { onConflict: "name" })
        .select();
      
      if (error) {
        console.error("Error seeding category:", category.name, error);
      } else {
        console.log("Category seeded:", category.name);
      }
    }
  } catch (err) {
    console.error("Unexpected error seeding categories:", err);
  }
}

// Requests
export async function createRequest(
  title: string,
  description: string,
  categoryId: number,
  budgetCredits: number
) {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("requests")
      .insert([{ 
        user_id: user.user.id, 
        title, 
        description, 
        category_id: categoryId, 
        budget_credits: budgetCredits 
      }])
      .select();

    if (error) {
      console.error("Supabase error creating request:", error);
      throw new Error(error.message || "Failed to create request");
    }

    if (!data) {
      throw new Error("No data returned from request creation");
    }

    return data;
  } catch (err) {
    console.error("Error in createRequest:", err);
    throw err;
  }
}

export async function fetchRequests() {
  try {
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

    if (error) {
      console.error("Supabase error fetching requests:", error);
      throw new Error(error.message || "Failed to fetch requests");
    }

    return data || [];
  } catch (err) {
    console.error("Error in fetchRequests:", err);
    throw err;
  }
}

// Offers
export async function createOffer(
  title: string,
  description: string,
  categoryId: number,
  priceCredits: number
) {
  try {
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

    if (error) {
      console.error("Supabase error creating offer:", error);
      throw new Error(error.message || "Failed to create offer");
    }

    if (!data) {
      throw new Error("No data returned from offer creation");
    }

    return data;
  } catch (err) {
    console.error("Error in createOffer:", err);
    throw err;
  }
}

export async function fetchOffers() {
  try {
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

    if (error) {
      console.error("Supabase error fetching offers:", error);
      throw new Error(error.message || "Failed to fetch offers");
    }

    return data || [];
  } catch (err) {
    console.error("Error in fetchOffers:", err);
    throw err;
  }
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
