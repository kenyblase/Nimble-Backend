import Review from "../models/reviewModel.js";

export const updateAverageRating = async (reviewedId, reviewedModel) => {
  const reviews = await Review.find({ reviewedId, reviewedModel });

  const numReviews = reviews.length;
  const avgRating =
    numReviews > 0
      ? reviews.reduce((acc, cur) => acc + cur.rating, 0) / numReviews
      : 0;

  const Model = (await import(`../models/${reviewedModel}.js`)).default;

  await Model.findByIdAndUpdate(reviewedId, {
    averageRating: avgRating.toFixed(1),
    numReviews,
  });
};
