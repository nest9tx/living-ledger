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
    { name: "Spirituality & Energy Work", icon: "✨" },
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
  budgetCredits: number,
  quantity?: number | null,
  images?: Array<{ id: string; storage_path: string; filename: string }> | null
) {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    if (budgetCredits < 5 || budgetCredits > 100) {
      throw new Error("Budget must be between 5 and 100 credits");
    }

    const { data, error } = await supabase
      .from("requests")
      .insert([{ 
        user_id: user.user.id, 
        title, 
        description, 
        category_id: categoryId, 
        budget_credits: budgetCredits,
        quantity: quantity,
        images: images ? images.map(img => ({
          id: img.id,
          storage_path: img.storage_path,
          filename: img.filename
        })) : [],
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
         category_id`
      )
      .eq("suspended", false)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error fetching requests:", error);
      throw new Error(error.message || "Failed to fetch requests");
    }

    // Fetch related data separately to avoid schema cache issues
    let enrichedData = data || [];
    if (enrichedData.length > 0) {
      // Fetch categories
      const { data: categoryData } = await supabase
        .from("categories")
        .select("id, name, icon");
      
      const categoryMap = categoryData?.reduce((map, cat) => {
        map[cat.id] = cat;
        return map;
      }, {} as Record<number, any>) || {};
      
      // Fetch profiles
      const userIds = [...new Set(enrichedData.map(req => req.user_id))];
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, average_rating, total_ratings, total_contributions")
        .in("id", userIds);
      
      if (profileError) {
        console.error("Error fetching profiles:", profileError);
      }
      
      const profileMap = profileData?.reduce((map, profile) => {
        map[profile.id] = profile;
        return map;
      }, {} as Record<string, any>) || {};

      // Fetch boost data
      const requestIds = enrichedData.map(req => req.id);
      const { data: boostData } = await supabase
        .from("listing_boosts")
        .select("post_id, boost_tier, expires_at")
        .eq("post_type", "request")
        .in("post_id", requestIds)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString());

      // Group ALL active boosts per listing (a listing can have homepage + category simultaneously)
      const boostMap = (boostData || []).reduce((map, boost) => {
        if (!map[boost.post_id]) map[boost.post_id] = [];
        map[boost.post_id].push(boost);
        return map;
      }, {} as Record<number, any[]>);

      // Helper: prefer homepage tier in single-tier contexts; otherwise pick first
      const primaryBoost = (id: number) => {
        const boosts = boostMap[id];
        if (!boosts || boosts.length === 0) return null;
        return boosts.find((b: any) => b.boost_tier === "homepage") || boosts[0];
      };

      // Fetch listing images
      const { data: imageData, error: imageError } = await supabase
        .from("listing_images")
        .select("id, listing_id, storage_path, filename, file_size, mime_type, upload_order")
        .eq("listing_type", "request")
        .in("listing_id", requestIds)
        .order("upload_order", { ascending: true });

      if (imageError) {
        console.error("Error fetching request images:", imageError);
      }

      const imageMap = imageData?.reduce((map, image) => {
        if (!map[image.listing_id]) {
          map[image.listing_id] = [];
        }
        map[image.listing_id].push(image);
        return map;
      }, {} as Record<number, any[]>) || {};
      
      enrichedData = enrichedData.map(req => ({
        ...req,
        categories: req.category_id ? categoryMap[req.category_id] : null,
        profiles: req.user_id ? profileMap[req.user_id] : null,
        images: imageMap[req.id] || [],
        isBoosted: (boostMap[req.id]?.length || 0) > 0,
        boostTier: primaryBoost(req.id)?.boost_tier || null,
        boostExpiresAt: primaryBoost(req.id)?.expires_at || null,
        hasHomepageBoost: (boostMap[req.id] || []).some((b: any) => b.boost_tier === "homepage"),
        hasCategoryBoost: (boostMap[req.id] || []).some((b: any) => b.boost_tier === "category"),
      }));
    }

    return enrichedData;
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
  priceCredits: number,
  quantity?: number | null,
  images?: Array<{ id: string; storage_path: string; filename: string }> | null
) {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    if (priceCredits < 5 || priceCredits > 100) {
      throw new Error("Price must be between 5 and 100 credits");
    }

    const { data, error } = await supabase
      .from("offers")
      .insert([
        {
          user_id: user.user.id,
          title,
          description,
          category_id: categoryId,
          price_credits: priceCredits,
          quantity: quantity,
          images: images ? images.map(img => ({
            id: img.id,
            storage_path: img.storage_path,
            filename: img.filename
          })) : [],
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
         category_id`
      )
      .eq("suspended", false)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error fetching offers:", error);
      throw new Error(error.message || "Failed to fetch offers");
    }

    // Fetch related data separately to avoid schema cache issues
    let enrichedData = data || [];
    if (enrichedData.length > 0) {
      // Fetch categories
      const { data: categoryData } = await supabase
        .from("categories")
        .select("id, name, icon");
      
      const categoryMap = categoryData?.reduce((map, cat) => {
        map[cat.id] = cat;
        return map;
      }, {} as Record<number, any>) || {};
      
      // Fetch profiles
      const userIds = [...new Set(enrichedData.map(offer => offer.user_id))];
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, average_rating, total_ratings, total_contributions")
        .in("id", userIds);
      
      if (profileError) {
        console.error("Error fetching profiles:", profileError);
      }
      
      const profileMap = profileData?.reduce((map, profile) => {
        map[profile.id] = profile;
        return map;
      }, {} as Record<string, any>) || {};

      // Fetch boost data
      const offerIds = enrichedData.map(offer => offer.id);
      const { data: boostData } = await supabase
        .from("listing_boosts")
        .select("post_id, boost_tier, expires_at")
        .eq("post_type", "offer")
        .in("post_id", offerIds)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString());

      const boostMap = (boostData || []).reduce((map, boost) => {
        if (!map[boost.post_id]) map[boost.post_id] = [];
        map[boost.post_id].push(boost);
        return map;
      }, {} as Record<number, any[]>);

      const primaryBoost = (id: number) => {
        const boosts = boostMap[id];
        if (!boosts || boosts.length === 0) return null;
        return boosts.find((b: any) => b.boost_tier === "homepage") || boosts[0];
      };

      // Fetch listing images
      const { data: imageData, error: imageError } = await supabase
        .from("listing_images")
        .select("id, listing_id, storage_path, filename, file_size, mime_type, upload_order")
        .eq("listing_type", "offer")
        .in("listing_id", offerIds)
        .order("upload_order", { ascending: true });

      if (imageError) {
        console.error("Error fetching offer images:", imageError);
      }

      const imageMap = imageData?.reduce((map, image) => {
        if (!map[image.listing_id]) {
          map[image.listing_id] = [];
        }
        map[image.listing_id].push(image);
        return map;
      }, {} as Record<number, any[]>) || {};
      
      enrichedData = enrichedData.map(offer => ({
        ...offer,
        categories: offer.category_id ? categoryMap[offer.category_id] : null,
        profiles: offer.user_id ? profileMap[offer.user_id] : null,
        images: imageMap[offer.id] || [],
        isBoosted: (boostMap[offer.id]?.length || 0) > 0,
        boostTier: primaryBoost(offer.id)?.boost_tier || null,
        boostExpiresAt: primaryBoost(offer.id)?.expires_at || null,
        hasHomepageBoost: (boostMap[offer.id] || []).some((b: any) => b.boost_tier === "homepage"),
        hasCategoryBoost: (boostMap[offer.id] || []).some((b: any) => b.boost_tier === "category"),
      }));
    }

    return enrichedData;
  } catch (err) {
    console.error("Error in fetchOffers:", err);
    throw err;
  }
}

// Credit balance & transactions
export async function getUserCredits() {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    // Get balance from profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credits_balance, earned_credits, purchased_credits")
      .eq("id", user.user.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile balance:", profileError);
      throw profileError;
    }

    // Get transaction history
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.user.id)
      .order("created_at", { ascending: false })
      .limit(50); // Last 50 transactions

    if (txError) {
      console.error("Error fetching transactions:", txError);
      throw txError;
    }

    return { 
      balance: profile?.credits_balance || 0,
      earnedCredits: profile?.earned_credits || 0,
      purchasedCredits: profile?.purchased_credits || 0,
      transactions: transactions || [] 
    };
  } catch (err) {
    console.error("Error in getUserCredits:", err);
    throw err;
  }
}

export async function recordTransaction(
  amount: number,
  description: string,
  transactionType: string = 'other',
  relatedOfferId?: number,
  relatedRequestId?: number
) {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("transactions")
      .insert([
        {
          user_id: user.user.id,
          amount,
          description,
          transaction_type: transactionType,
          related_offer_id: relatedOfferId,
          related_request_id: relatedRequestId,
        },
      ])
      .select();

    if (error) {
      console.error("Error recording transaction:", error);
      throw error;
    }

    // Balance is automatically updated by database trigger
    return data;
  } catch (err) {
    console.error("Error in recordTransaction:", err);
    throw err;
  }
}

// Delete functions
export async function deleteRequest(requestId: number) {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    console.log("Attempting to delete request:", requestId, "by user:", user.user.id);

    const { error, data } = await supabase
      .from("requests")
      .delete()
      .eq("id", requestId)
      .eq("user_id", user.user.id)
      .select(); // Return deleted row to confirm

    if (error) {
      console.error("Supabase error deleting request:", error);
      throw new Error(error.message || "Failed to delete request");
    }

    console.log("Delete result:", data);

    if (!data || data.length === 0) {
      throw new Error("Request not found or you don't have permission to delete it");
    }

    return true;
  } catch (err) {
    console.error("Error in deleteRequest:", err);
    throw err;
  }
}

export async function deleteOffer(offerId: number) {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    console.log("Attempting to delete offer:", offerId, "by user:", user.user.id);

    const { error, data } = await supabase
      .from("offers")
      .delete()
      .eq("id", offerId)
      .eq("user_id", user.user.id)
      .select(); // Return deleted row to confirm

    if (error) {
      console.error("Supabase error deleting offer:", error);
      throw new Error(error.message || "Failed to delete offer");
    }

    console.log("Delete result:", data);

    if (!data || data.length === 0) {
      throw new Error("Offer not found or you don't have permission to delete it");
    }

    return true;
  } catch (err) {
    console.error("Error in deleteOffer:", err);
    throw err;
  }
}
