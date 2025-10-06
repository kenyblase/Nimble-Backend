import Request from "../models/requestModel.js";

// Create a new request
export const createRequest = async (req, res) => {
  try {
    const userId = req.userId; // assuming verifyToken middleware sets this
    const {
      category,
      productImages,
      videoLink,
      title,
      location,
      condition,
      description,
      price,
      isNegotiable,
    } = req.body;

    const newRequest = new Request({
      user: userId,
      category,
      productImages,
      videoLink,
      title,
      location,
      condition,
      description,
      price,
      isNegotiable,
    });

    await newRequest.save();

    res.status(201).json({
      success: true,
      message: "Request created successfully",
      data: newRequest,
    });
  } catch (error) {
    console.error("Error creating request:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getAllRequests = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Optional filters
    const { category, state, city, condition, search } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (condition) filter.condition = condition;
    if (state) filter["location.state"] = state;
    if (city) filter["location.city"] = city;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Fetch requests with pagination and filtering
    const [requests, totalCount] = await Promise.all([
      Request.find(filter)
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Request.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      message: "Requests fetched successfully",
      data: requests,
      pagination: {
        totalItems: totalCount,
        currentPage: page,
        totalPages,
        pageSize: limit,
      },
    });
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};