export type AuctionStatus = "pending" | "active" | "ended";

export type Bid = {
  id: string;
  bidderName: string;
  amount: number;
  time: string;
};

export type AuctionItem = {
  id: string;
  title: string;
  description: string;
  image: string;
  images: string[];
  startingPrice: number;
  currentPrice: number;
  minIncrement: number;
  bidCount: number;
  bids: Bid[];
  sellerId?: number;
  seller: string;
  sellerAvatar?: string | null;
  startTime: string;
  endTime: string;
  status: AuctionStatus;
  categories: string[];
};

export type ReviewMedia = {
  type: "image" | "video";
  url: string;
};

export type Review = {
  id: string;
  buyerId: number;
  buyerName: string;
  buyerAvatar: string | null;
  auctionId: string;
  auctionTitle: string;
  rating: number;
  comment: string;
  media: ReviewMedia[];
  createdAt: string;
};

export type UserProfile = {
  id: number;
  username: string;
  avatar: string | null;
  role: string;
  joinedAt: string;
  auctionCount: number;
  auctions: AuctionItem[];
  reviews: Review[];
  averageRating: number;
};
