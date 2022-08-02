const { check } = require("express-validator");
const {
  validateReviewData,
  validateSpotData,
  validateImageData,
} = require("../../utils/validation");

const { requireAuth, verifyOwner } = require("../../utils/auth");
const {
  Booking,
  Spot,
  User,
  Image,
  Review,
  sequelize,
} = require("../../db/models");
const { Op } = require("sequelize");
const express = require("express");
const e = require("express");
const router = express.Router();

const spotFound = function (spot, next) {
  if (!spot) {
    const err = new Error("Spot couldn't be found");
    err.message = "Spot couldn't be found";
    err.status = 404;
    next(err);
    return err;
  } else {
    return true;
  }
};

router.get("/", async (req, res, next) => {
  // need to add avgReview and previewImage once implemented
  const spots = await Spot.findAll({
    include: {
      model: Review,
      attributes: [],
    },
  });
  for (let spot of spots) {
    const spotReviewData = await spot.getReviews({
      attributes: [
        [sequelize.fn("AVG", sequelize.col("stars")), "avgStarRating"],
      ],
    });

    const avgRating = spotReviewData[0].dataValues.avgStarRating;
    spot.dataValues.avgRating = Number(avgRating).toFixed(1);
    const previewImage = await Image.findOne({
      where: {
        [Op.and]: {
          spotId: spot.id,
          previewImage: true,
        },
      },
    });
    if (previewImage) {
      spot.dataValues.previewImage = previewImage.dataValues.url;
    }
  }
  res.json({ Spots: spots });
});

router.get("/current", requireAuth, async (req, res, next) => {
  const { user } = req;
  const userId = user.dataValues.id;
  // need to add avgRating and previewImage once implemented
  const spots = await Spot.findAll({
    where: {
      ownerId: userId,
    },
  });
  for (let spot of spots) {
    const spotReviewData = await spot.getReviews({
      attributes: [
        [sequelize.fn("AVG", sequelize.col("stars")), "avgStarRating"],
      ],
    });
    const avgRating = spotReviewData[0].dataValues.avgStarRating;
    spot.dataValues.avgRating = Number(avgRating).toFixed(1);
    const previewImage = await Image.findOne({
      where: {
        [Op.and]: {
          spotId: spot.id,
          previewImage: true,
        },
      },
    });
    if (previewImage) {
      spot.dataValues.previewImage = previewImage.dataValues.url;
    }
  }
  res.json({ Spots: spots });
});

router.get("/:spotId", async (req, res, next) => {
  // must add numReviews, and avgStarRating once implemented.
  const template = {
    id: 0,
    ownerId: 0,
    address: "",
    city: "",
    state: "",
    country: "",
    lat: 0,
    lng: 0,
    name: "",
    description: "",
    price: 123,
    createdAt: "",
    updatedAt: "",
    numReviews: 0,
    avgStarRating: 0,
    Images: [
      {
        id: 0,
        imageableId: 0,
        url: "",
      },
    ],
    Owner: {
      id: 0,
      firstName: "",
      lastName: "",
    },
  };
  const spot = await Spot.findByPk(req.params.spotId, {
    include: [
      {
        model: Image,
        attributes: ["id", "url"],
        group: "id",
      },
      {
        model: User,
        as: "Owner",
        attributes: ["id", "firstName", "lastName"],
      },
    ],
  });

  if (spotFound(spot, next)) {
    const reviewData = await spot.getReviews({
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "numReviews"],
        [sequelize.fn("AVG", sequelize.col("stars")), "avgRating"],
      ],
    });
    spot.dataValues.numReviews = reviewData[0].dataValues.numReviews;
    spot.dataValues.avgStarRating = Number(
      reviewData[0].dataValues.avgRating
    ).toFixed(1);
    const out = Object.assign(template, spot.toJSON());
    res.json(out);
  }
});

router.get("/:spotId/reviews", async (req, res, next) => {
  const spot = await Spot.findByPk(req.params.spotId);
  if (spotFound(spot, next)) {
    const reviews = await spot.getReviews();
    for (let review of reviews) {
      const owner = await review.getUser({
        attributes: ["id", "firstName", "lastName"],
      });
      const images = await review.getImages({
        attributes: ["id", "reviewId", "url"],
      });
      review.dataValues.User = owner.toJSON();
      review.dataValues.Images = images;
    }
    res.json({ Reviews: reviews });
  }
});

router.put(
  "/:spotId",
  requireAuth,
  validateSpotData,
  async (req, res, next) => {
    const spot = await Spot.findByPk(req.params.spotId);
    // Check if we found the spot and that the current user is the spot owner
    if (spotFound(spot, next) && verifyOwner(req.user, spot, next)) {
      spot.set(req.body);
      await spot.save();
      res.json(spot);
    }
  }
);

router.delete("/:spotId", requireAuth, async (req, res, next) => {
  const spot = await Spot.findByPk(req.params.spotId);
  // Check if we found the spot and that the current user is the spot owner
  if (spotFound(spot, next) && verifyOwner(req.user, spot, next)) {
    await spot.destroy();
    res.json({
      message: "Successfully deleted",
      statusCode: 200,
    });
  }
});
router.post("/", requireAuth, validateSpotData, async (req, res, next) => {
  const id = req.user.id;
  const spotData = Object.assign({ ownerId: id }, req.body);
  const newSpot = await Spot.create(spotData);
  res.status(201);
  res.json(newSpot);
});

router.post(
  "/:spotId/reviews",
  requireAuth,
  validateReviewData,
  async (req, res, next) => {
    const spot = await Spot.findByPk(req.params.spotId);
    if (spotFound(spot, next)) {
      const template = {
        userId: req.user.id,
        spotId: spot.id,
      };
      const reviewData = Object.assign(template, req.body);
      const newReview = await Review.create(reviewData).catch((e) => {
        res.status(403);
        res.json({
          message: "User already has a review for this spot",
          statusCode: 403,
        });
      });
      res.status(201);
      res.json(newReview);
    }
  }
);

router.post(
  "/:spotId/images",
  requireAuth,
  validateImageData,
  async (req, res, next) => {
    const spot = await Spot.findByPk(req.params.spotId);
    const { url } = req.body;

    if (spotFound(spot, next) && verifyOwner(req.user, spot, next)) {
      const images = await spot.getImages();
      if (images.length >= 10) {
        const err = new Error(
          "Maximum number of images for this resource was reached"
        );
        err.message = "Maximum number of images for this resource was reached";
        err.status = 403;
        next(err);
      }
      const image = await spot.createImage({
        url,
        spotId: req.params.spotId,
        userId: req.user.id,
      });
      res.status(201);
      res.json({
        id: image.id,
        imageableId: image.spotId,
        url: image.url,
      });
    }
  }
);

router.post("/:spotId/bookings", requireAuth, async (req, res, next) => {
  const spot = await Spot.findByPk(req.params.spotId);
  if (spotFound(spot, next) && spot.ownerId !== req.user.id) {
    const { startDate, endDate } = req.body;
    const currentSpotBookings = await Booking.findAll({
      where: {
        spotId: req.params.spotId,
        [Op.and]: [
          {
            startDate: {
              [Op.lte]: endDate,
            },
          },
          {
            endDate: {
              [Op.gte]: startDate,
            },
          },
        ],
      },
    });

    if (currentSpotBookings.length) {
      const err = new Error(
        "Sorry, this spot is already booked for the specified dates"
      );
      err.status = 403;
      err.message =
        "Sorry, this spot is already booked for the specified dates";
      err.errors = {
        startDate: "Start date conflicts with an existing booking",
        endDate: "End date conflicts with an existing booking",
      };
      return next(err);
    }

    const booking = await spot.createBooking({
      spotId: req.params.spotId,
      userId: req.user.id,
      startDate,
      endDate,
    });
    res.status(201);
    res.json({
      id: booking.id,
      spotId: booking.spotId,
      userId: booking.userId,
      startDate: booking.startDate,
      endDate: booking.endDate,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    });
  }
  if (spot.ownerId === req.user.id) {
    const err = new Error("Forbidden");
    err.message = "Forbidden";
    err.status = 403;
    next(err);
  }
});

router.get("/:spotId/bookings", requireAuth, async (req, res, next) => {
  const spot = await Spot.findByPk(req.params.spotId);
  const ownerExpected = {
    User: {
      id: "",
      firstName: "",
      lastName: "",
    },
    id: "",
    spotId: "",
    userId: "",
    startDate: "",
    endDate: "",
    createdAt: "",
    updatedAt: "",
  };
  if (spotFound(spot, next) && spot.ownerId === req.user.id) {
    const bookings = await spot.getBookings({
      include: {
        model: User,
      },
    });
    const out = bookings.map((booking) =>
      Object.assign(ownerExpected, booking.toJSON())
    );
    res.json({ Bookings: out });
  } else if (spotFound(spot, next) && spot.ownerId !== req.user.id) {
    const bookings = await spot.getBookings({
      attributes: ["spotId", "startDate", "endDate"],
    });
    res.json({ Bookings: bookings });
  }
});

module.exports = router;
