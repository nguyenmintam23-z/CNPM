
type MenuStatusProps = {
  status: "loading" | "empty" | "error";
  onRetry?: () => void;
};

export default function MenuStatus({
  status,
  onRetry,
}: MenuStatusProps) {
  if (status === "loading") {
    return (
      <p
        role="status"
        className="text-center text-gray-700"
      >
        Đang tải menu...
      </p>
    );
  }

  if (status === "empty") {
    return (
      <p className="text-center text-gray-700">
        Hiện chưa có sản phẩm.
      </p>
    );
  }

  return (
    <div role="alert" className="text-center">
      <p className="text-gray-800">
        Không thể tải menu.
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg bg-amber-800 px-5 py-2 font-medium text-white hover:bg-amber-900"
        >
          Thử lại
        </button>
      )}
    </div>
  );
}
