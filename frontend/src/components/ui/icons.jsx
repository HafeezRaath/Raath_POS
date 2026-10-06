import React from 'react';

// Base helper for Lucide SVG icons
const createIcon = (paths, defaultSize = 20) => {
  const IconComponent = ({ size = defaultSize, className = '', strokeWidth = 2, ...props }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {paths}
    </svg>
  );
  IconComponent.displayName = 'LucideIcon';
  return IconComponent;
};

// ==================== ICONS LIST ====================
export const LayoutDashboard = createIcon(
  <>
    <rect width="7" height="9" x="3" y="3" rx="1" />
    <rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" />
    <rect width="7" height="5" x="3" y="16" rx="1" />
  </>
);
export const Dashboard = LayoutDashboard;

export const ShoppingCart = createIcon(
  <>
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </>
);
export const Cart = ShoppingCart;

export const PointOfSale = createIcon(
  <>
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" x2="22" y1="10" y2="10" />
    <line x1="6" x2="8" y1="15" y2="15" />
    <line x1="12" x2="16" y1="15" y2="15" />
  </>
);
export const CreditCard = PointOfSale;
export const Payment = PointOfSale;

export const Receipt = createIcon(
  <>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <path d="M16 8h-8" />
    <path d="M16 12h-8" />
    <path d="M10 16h-2" />
  </>
);
export const ReceiptLong = Receipt;

export const Package = createIcon(
  <>
    <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.29 7 12 12 20.71 7" />
    <line x1="12" x2="12" y1="22" y2="12" />
  </>
);
export const Inventory = Package;
export const Box = Package;

export const Layers = createIcon(
  <>
    <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m22 12.5-9.42 4.29a2 2 0 0 1-1.16 0L2 12.5" />
    <path d="m22 17.5-9.42 4.29a2 2 0 0 1-1.16 0L2 17.5" />
  </>
);
export const Category = Layers;

export const Truck = createIcon(
  <>
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
    <path d="M15 18H9" />
    <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
    <circle cx="17" cy="18.5" r="2.5" />
    <circle cx="7" cy="18.5" r="2.5" />
  </>
);
export const LocalShipping = Truck;

export const Users = createIcon(
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>
);
export const People = Users;
export const Group = Users;

export const User = createIcon(
  <>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>
);
export const Person = User;
export const AccountCircle = User;

export const UserCheck = createIcon(
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <polyline points="16 11 18 13 22 9" />
  </>
);

export const UserX = createIcon(
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="17" x2="22" y1="8" y2="13" />
    <line x1="22" x2="17" y1="8" y2="13" />
  </>
);

export const Wrench = createIcon(
  <>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </>
);
export const Build = Wrench;

export const Briefcase = createIcon(
  <>
    <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    <rect width="20" height="14" x="2" y="6" rx="2" />
  </>
);
export const HomeRepairService = Briefcase;

export const DollarSign = createIcon(
  <>
    <line x1="12" x2="12" y1="2" y2="22" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </>
);
export const AttachMoney = DollarSign;
export const MonetizationOn = DollarSign;

export const TrendingDown = createIcon(
  <>
    <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
    <polyline points="16 17 22 17 22 11" />
  </>
);
export const MoneyOff = TrendingDown;

export const Landmark = createIcon(
  <>
    <line x1="3" x2="21" y1="22" y2="22" />
    <line x1="6" x2="6" y1="18" y2="11" />
    <line x1="10" x2="10" y1="18" y2="11" />
    <line x1="14" x2="14" y1="18" y2="11" />
    <line x1="18" x2="18" y1="18" y2="11" />
    <polygon points="12 2 20 7 4 7" />
  </>
);
export const AccountBalance = Landmark;

export const BarChart2 = createIcon(
  <>
    <line x1="18" x2="18" y1="20" y2="10" />
    <line x1="12" x2="12" y1="20" y2="4" />
    <line x1="6" x2="6" y1="20" y2="14" />
  </>
);
export const Assessment = BarChart2;
export const BarChart = BarChart2;

export const Clock = createIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </>
);
export const History = Clock;
export const Schedule = Clock;

export const Target = createIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </>
);
export const TrackChanges = Target;

export const UploadCloud = createIcon(
  <>
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    <path d="M12 12v9" />
    <path d="m16 16-4-4-4 4" />
  </>
);
export const CloudUpload = UploadCloud;
export const Upload = UploadCloud;

export const DownloadCloud = createIcon(
  <>
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    <path d="M12 12v9" />
    <path d="m8 17 4 4 4-4" />
  </>
);
export const CloudDownload = DownloadCloud;
export const Download = DownloadCloud;

export const Database = createIcon(
  <>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5V19A9 3 0 0 0 21 19V5" />
    <path d="M3 12A9 3 0 0 0 21 12" />
  </>
);
export const Storage = Database;

export const Settings = createIcon(
  <>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </>
);

export const Shield = createIcon(
  <>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </>
);
export const Security = Shield;

export const LogOut = createIcon(
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" x2="9" y1="12" y2="12" />
  </>
);
export const Logout = LogOut;

export const Menu = createIcon(
  <>
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </>
);
export const MenuIcon = Menu;

export const X = createIcon(
  <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>
);
export const Close = X;

export const Plus = createIcon(
  <>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </>
);
export const Add = Plus;

export const Minus = createIcon(
  <>
    <path d="M5 12h14" />
  </>
);
export const Remove = Minus;

export const Trash2 = createIcon(
  <>
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" x2="10" y1="11" y2="17" />
    <line x1="14" x2="14" y1="11" y2="17" />
  </>
);
export const Trash = Trash2;
export const Delete = Trash2;

export const Edit3 = createIcon(
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </>
);
export const Edit = Edit3;

export const Search = createIcon(
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>
);

export const Filter = createIcon(
  <>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </>
);
export const FilterList = Filter;

export const RotateCw = createIcon(
  <>
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </>
);
export const Refresh = RotateCw;
export const RefreshCw = RotateCw;
export const Sync = RotateCw;

export const RotateCcw = createIcon(
  <>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </>
);
export const AssignmentReturn = RotateCcw;
export const Undo = RotateCcw;

export const AlertTriangle = createIcon(
  <>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" x2="12" y1="9" y2="13" />
    <line x1="12" x2="12.01" y1="17" y2="17" />
  </>
);
export const Warning = AlertTriangle;

export const AlertCircle = createIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </>
);
export const Error = AlertCircle;
export const ErrorIcon = AlertCircle;

export const CheckCircle = createIcon(
  <>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </>
);

export const Check = createIcon(
  <>
    <polyline points="20 6 9 17 4 12" />
  </>
);

export const Info = createIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </>
);
export const InfoIcon = Info;

export const Calendar = createIcon(
  <>
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </>
);
export const CalendarToday = Calendar;
export const DateRange = Calendar;

export const TrendingUp = createIcon(
  <>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </>
);

export const ArrowUp = createIcon(
  <>
    <line x1="12" x2="12" y1="19" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </>
);
export const ArrowUpward = ArrowUp;

export const ArrowDown = createIcon(
  <>
    <line x1="12" x2="12" y1="5" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </>
);
export const ArrowDownward = ArrowDown;

export const ArrowLeft = createIcon(
  <>
    <line x1="19" x2="5" y1="12" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </>
);
export const ArrowBack = ArrowLeft;

export const ArrowRight = createIcon(
  <>
    <line x1="5" x2="19" y1="12" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </>
);
export const ArrowForward = ArrowRight;

export const ChevronDown = createIcon(
  <>
    <polyline points="6 9 12 15 18 9" />
  </>
);
export const KeyboardArrowDown = ChevronDown;

export const ChevronUp = createIcon(
  <>
    <polyline points="18 15 12 9 6 15" />
  </>
);
export const KeyboardArrowUp = ChevronUp;

export const ChevronLeft = createIcon(
  <>
    <polyline points="15 18 9 12 15 6" />
  </>
);

export const ChevronRight = createIcon(
  <>
    <polyline points="9 18 15 12 9 6" />
  </>
);

export const Printer = createIcon(
  <>
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect width="12" height="8" x="6" y="14" />
  </>
);
export const Print = Printer;

export const Share2 = createIcon(
  <>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
    <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
  </>
);
export const Share = Share2;

export const QrCode = createIcon(
  <>
    <rect width="5" height="5" x="3" y="3" rx="1" />
    <rect width="5" height="5" x="16" y="3" rx="1" />
    <rect width="5" height="5" x="3" y="16" rx="1" />
    <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
    <path d="M21 21v.01" />
    <path d="M12 7v3a2 2 0 0 1-2 2H7" />
    <path d="M3 12h.01" />
    <path d="M12 3h.01" />
    <path d="M12 16v.01" />
    <path d="M16 12h1" />
    <path d="M21 12v.01" />
    <path d="M12 21v-1" />
  </>
);

export const Barcode = createIcon(
  <>
    <path d="M3 5v14" />
    <path d="M8 5v14" />
    <path d="M12 5v14" />
    <path d="M17 5v14" />
    <path d="M21 5v14" />
  </>
);

export const Phone = createIcon(
  <>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </>
);

export const Mail = createIcon(
  <>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </>
);
export const Email = Mail;

export const MapPin = createIcon(
  <>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </>
);
export const LocationOn = MapPin;

export const Tag = createIcon(
  <>
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
    <path d="M7 7h.01" />
  </>
);
export const LocalOffer = Tag;

export const Store = createIcon(
  <>
    <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
    <path d="M2 7h20" />
    <path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7" />
  </>
);

export const Eye = createIcon(
  <>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </>
);
export const Visibility = Eye;

export const EyeOff = createIcon(
  <>
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </>
);
export const VisibilityOff = EyeOff;

export const Lock = createIcon(
  <>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>
);

export const Bell = createIcon(
  <>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </>
);
export const Notifications = Bell;

export const Maximize2 = createIcon(
  <>
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" x2="14" y1="3" y2="10" />
    <line x1="3" x2="10" y1="21" y2="14" />
  </>
);
export const Fullscreen = Maximize2;

export const Minimize2 = createIcon(
  <>
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="14" x2="21" y1="10" y2="3" />
    <line x1="3" x2="10" y1="21" y2="14" />
  </>
);
export const FullscreenExit = Minimize2;

export const Pause = createIcon(
  <>
    <rect width="4" height="16" x="6" y="4" />
    <rect width="4" height="16" x="14" y="4" />
  </>
);

export const Play = createIcon(
  <>
    <polygon points="5 3 19 12 5 21 5 3" />
  </>
);
export const PlayArrow = Play;

export const Save = createIcon(
  <>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </>
);

export const Copy = createIcon(
  <>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </>
);
export const ContentCopy = Copy;

export const CloudCheck = createIcon(
  <>
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    <polyline points="8 15 11 18 16 13" />
  </>
);
export const CloudDone = CloudCheck;

export const CloudX = createIcon(
  <>
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    <line x1="10" x2="14" y1="13" y2="17" />
    <line x1="14" x2="10" y1="13" y2="17" />
  </>
);
export const CloudOff = CloudX;

export const MoreVertical = createIcon(
  <>
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </>
);
export const MoreVert = MoreVertical;

export const MoreHorizontal = createIcon(
  <>
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </>
);
export const MoreHoriz = MoreHorizontal;

export const Circle = createIcon(
  <>
    <circle cx="12" cy="12" r="10" />
  </>
);

export const Home = createIcon(
  <>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </>
);

export const Sliders = createIcon(
  <>
    <line x1="4" x2="4" y1="21" y2="14" />
    <line x1="4" x2="4" y1="10" y2="3" />
    <line x1="12" x2="12" y1="21" y2="12" />
    <line x1="12" x2="12" y1="8" y2="3" />
    <line x1="20" x2="20" y1="21" y2="16" />
    <line x1="20" x2="20" y1="12" y2="3" />
    <line x1="1" x2="7" y1="14" y2="14" />
    <line x1="9" x2="15" y1="8" y2="8" />
    <line x1="17" x2="23" y1="16" y2="16" />
  </>
);

export const PieChart = createIcon(
  <>
    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
    <path d="M22 12A10 10 0 0 0 12 2v10z" />
  </>
);

export const HelpCircle = createIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </>
);

export const Percent = createIcon(
  <>
    <line x1="19" x2="5" y1="5" y2="19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </>
);

export const Cancel = createIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </>
);

export const FileText = createIcon(
  <>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" x2="8" y1="13" y2="13" />
    <line x1="16" x2="8" y1="17" y2="17" />
    <line x1="10" x2="8" y1="9" y2="9" />
  </>
);
export const Assignment = FileText;

// Extra aliases for complete drop-in compatibility
export const QrCodeScanner = QrCode;
export const ViewModule = Layers;
export const ViewList = Menu;
export const Image = Package;
export const ImageIcon = Package;
export const Discount = Tag;
export const RemoveCircle = Minus;
export const VerifiedUser = Shield;
export const SyncIcon = Sync;
export const RefreshIcon = Refresh;
export const PrintIcon = Print;
export const ToggleOn = Check;
export const ToggleOff = X;
export const Today = Calendar;
export const LocalAtm = DollarSign;
export const PictureAsPdf = FileText;
export const PhoneIphone = Phone;
export const Storefront = Store;
export const ShowChart = TrendingUp;
export const AddShoppingCart = ShoppingCart;
export const Speed = Target;
export const TrendingFlat = Minus;
export const DoneAll = CheckCircle;
export const Rocket = TrendingUp;
export const Sparkles = CheckCircle;
export const ExpandMore = ChevronDown;
export const ExpandLess = ChevronUp;
export const Sun = createIcon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </>
);
export const Moon = createIcon(
  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
);
export const Lightbulb = Sun;
export const FiberManualRecord = Circle;
export const PersonAdd = Plus;
export const Key = Lock;
export const Login = LogOut;
export const LoginIcon = LogOut;
export const Business = Store;
export const DeleteSweep = Trash;
export const KeyboardReturn = RotateCcw;
export const PhoneAndroid = Phone;
export const Straighten = Sliders;
export const LocalGroceryStore = ShoppingCart;
export const Scale = Target;
export const AddCircle = Plus;
export const UploadFile = CloudUpload;
export const TableChart = BarChart2;
export const CameraAlt = Eye;
export const ContentPaste = Copy;
export const DocumentScanner = QrCode;
export const ClearAll = Refresh;
export const FileDownload = Download;
export const MedicalServices = HomeRepairService;
export const ShoppingBag = ShoppingCart;
export const BakeryDining = Store;
export const Agriculture = Layers;
export const Devices = Phone;
export const Medication = HomeRepairService;
export const Branding = Tag;
export const Label = Tag;
export const Checkroom = Package;
export const Inventory2 = Package;
export const AutoAwesome = CheckCircle;
export const LocalPrintshop = Print;
export const AccountBalanceWallet = Landmark;
export const Block = Cancel;
export const Note = FileText;
export const Description = FileText;
export const AccessTime = Clock;
export const RemoveShoppingCart = ShoppingCart;
export const Analytics = Assessment;
export const CategoryIcon = Category;
export const SwapHoriz = ArrowRight;
export const Balance = Landmark;
export const Savings = DollarSign;
export const MenuBook = FileText;
export const Keyboard = Sliders;
export const Calculate = Sliders;
export const CalcIcon = Sliders;
export const PayIcon = CreditCard;
export const HistoryIcon = History;
export const ArrowDropDown = ChevronDown;
export const CloudDownloadIcon = Download;
export const Done = Check;
export const Clear = X;
export const PostAdd = Plus;
export const Backup = CloudUpload;
export const Restore = RotateCcw;
export const FolderOpen = Category;
export const AttachFile = Tag;
export const Computer = Database;
export const Send = ArrowRight;

export const Pending = Clock;
export const DeleteOutline = Trash2;
export const DeleteIcon = Trash2;
export const Palette = createIcon(
  <>
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.5 17.5 2 12 2Z" />
  </>
);
export const AdminPanelSettings = Shield;
export const Pageview = Eye;
export const DesignServices = Palette;
export const Smartphone = Phone;
export const PowerSettingsNew = LogOut;
export const LinkOff = createIcon(
  <>
    <line x1="2" x2="22" y1="2" y2="22" />
    <path d="M10 14a3.5 3.5 0 0 0 5 0l4-4a3.5 3.5 0 0 0-5-5l-.5.5" />
    <path d="M14 10a3.5 3.5 0 0 0-5 0l-4 4a3.5 3.5 0 0 0 5 5l.5-.5" />
  </>
);
export const Timer = Clock;
export const AssignmentInd = Users;
export const Redeem = Tag;
export const Timeline = createIcon(
  <>
    <path d="M3 3v18h18" />
    <path d="m7 14 4-4 4 4 5-6" />
    <circle cx="7" cy="14" r="1.5" fill="currentColor" />
    <circle cx="11" cy="10" r="1.5" fill="currentColor" />
    <circle cx="15" cy="14" r="1.5" fill="currentColor" />
    <circle cx="20" cy="8" r="1.5" fill="currentColor" />
  </>
);

// Default export container
export default {
  LayoutDashboard,
  Dashboard,
  ShoppingCart,
  Cart,
  PointOfSale,
  CreditCard,
  Payment,
  Receipt,
  ReceiptLong,
  Package,
  Inventory,
  Box,
  Layers,
  Category,
  Truck,
  LocalShipping,
  Users,
  People,
  Group,
  User,
  Person,
  AccountCircle,
  UserCheck,
  UserX,
  Wrench,
  Build,
  Briefcase,
  HomeRepairService,
  DollarSign,
  AttachMoney,
  MonetizationOn,
  TrendingDown,
  MoneyOff,
  Landmark,
  AccountBalance,
  BarChart2,
  Assessment,
  BarChart,
  Clock,
  History,
  Schedule,
  Target,
  TrackChanges,
  UploadCloud,
  CloudUpload,
  Upload,
  DownloadCloud,
  CloudDownload,
  Download,
  Database,
  Storage,
  Settings,
  Shield,
  Security,
  LogOut,
  Logout,
  Menu,
  MenuIcon,
  X,
  Close,
  Plus,
  Add,
  Minus,
  Remove,
  Trash2,
  Trash,
  Delete,
  Edit3,
  Edit,
  Search,
  Filter,
  FilterList,
  RotateCw,
  Refresh,
  RefreshCw,
  Sync,
  RotateCcw,
  AssignmentReturn,
  Undo,
  AlertTriangle,
  Warning,
  AlertCircle,
  Error,
  ErrorIcon,
  CheckCircle,
  Check,
  Info,
  InfoIcon,
  Calendar,
  CalendarToday,
  DateRange,
  TrendingUp,
  ArrowUp,
  ArrowUpward,
  ArrowDown,
  ArrowDownward,
  ArrowLeft,
  ArrowBack,
  ArrowRight,
  ArrowForward,
  ChevronDown,
  KeyboardArrowDown,
  ChevronUp,
  KeyboardArrowUp,
  ChevronLeft,
  ChevronRight,
  Printer,
  Print,
  Share2,
  Share,
  QrCode,
  Barcode,
  Phone,
  Mail,
  Email,
  MapPin,
  LocationOn,
  Tag,
  LocalOffer,
  Store,
  Eye,
  Visibility,
  EyeOff,
  VisibilityOff,
  Lock,
  Bell,
  Notifications,
  Maximize2,
  Fullscreen,
  Minimize2,
  FullscreenExit,
  Pause,
  Play,
  PlayArrow,
  Save,
  Copy,
  ContentCopy,
  CloudCheck,
  CloudDone,
  CloudX,
  CloudOff,
  MoreVertical,
  MoreVert,
  MoreHorizontal,
  MoreHoriz,
  Circle,
  Home,
  Sliders,
  PieChart,
  HelpCircle,
  Percent,
  Cancel,
  FileText,
  Assignment,
  Timeline,
  Sun,
  Moon,
  Lightbulb,
};
