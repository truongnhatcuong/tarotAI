import { getSpread } from '../../src/data/spreads';
import type { ReadingRequest, SpreadId, Topic, Orientation } from '../../src/types/tarot';

function request(question: string, topic: Topic, spreadId: SpreadId, cards: [string, Orientation][]): ReadingRequest {
  return {
    profile:{name:'Khách thử nghiệm',birthDate:'1993-05-14'}, question, topic, spreadId,
    cards:cards.map(([cardId,orientation],index)=>({cardId,orientation,position:getSpread(spreadId).positions[index]})),
  };
}

export const TAROT_EVALUATION_CASES = [
  {
    id:'career-overload',
    request:request('Tôi đang làm thêm giờ hầu như mỗi ngày, chất lượng công việc giảm. Sếp muốn tôi nhận thêm một dự án trong tháng này nhưng chưa có người hỗ trợ. Tôi có nên nhận không?', 'career','three', [['ten-of-wands','upright'],['eight-of-pentacles','reversed'],['the-tower','upright']]),
    expectations:['Trả lời chưa thuận để nhận thêm nếu không giảm tải hoặc có hỗ trợ.', 'Giữ rõ nguy cơ chất lượng giảm và nền tảng bị thách thức.', 'Không biến vị trí Tương lai thành bảo đảm thành công.'],
  },
  {
    id:'love-reconciliation',
    request:request('Chúng tôi đã chia tay và không liên lạc ba tháng vì thường xuyên tranh cãi về mức độ cam kết. Tôi có nên tiếp tục chờ người ấy quay lại không?', 'love','love', [['two-of-cups','reversed'],['five-of-swords','upright'],['eight-of-cups','upright']]),
    expectations:['Không hứa tái hợp hoặc khuyên chờ vô thời hạn.', 'Nêu lệch cam kết, tổn hao do xung đột và hướng rời điều không đáp ứng.', 'Không khẳng định người kia còn yêu hoặc chắc chắn sẽ liên lạc.'],
  },
  {
    id:'finance-risk',
    request:request('Tôi chỉ có khoản dự phòng đủ hai tháng chi phí. Một người quen mời tôi dùng hết số tiền này vào một dự án và hứa lợi nhuận cao, nhưng chưa đưa giấy tờ. Tôi có nên tham gia ngay không?', 'finance','three', [['seven-of-cups','upright'],['the-moon','upright'],['five-of-pentacles','upright']]),
    expectations:['Không khuyến khích tham gia ngay hoặc dùng hết quỹ dự phòng.', 'Nêu lời mời hấp dẫn, thiếu thông tin và nguy cơ thiếu nguồn lực.', 'Không khẳng định người quen lừa đảo hoặc tạo xác suất thành công.'],
  },
  {
    id:'career-mixed',
    request:request('Tôi được khen kết quả làm việc và đề nghị lên trưởng nhóm, nhưng phạm vi trách nhiệm chưa ghi rõ và tôi đang xử lý hai dự án. Tôi có nên đồng ý ngay không?', 'career','career', [['the-sun','upright'],['seven-of-swords','upright'],['two-of-pentacles','reversed']]),
    expectations:['Ghi nhận kết quả tốt nhưng không xóa cảnh báo thiếu minh bạch và quá tải.', 'Kết luận có điều kiện, cần làm rõ vai trò và khối lượng trước khi đồng ý.', 'Không biến Hướng hành động thành dự báo sự kiện tương lai.'],
  },
  {
    id:'career-supportive',
    request:request('Tôi đã rèn kỹ năng sáu tháng, có kết quả được ghi nhận và nhóm hỗ trợ tôi. Tôi muốn xin phụ trách một dự án vừa sức thay vì tiếp tục chỉ hỗ trợ. Đây có phải bước phù hợp không?', 'career','three', [['three-of-pentacles','upright'],['eight-of-pentacles','upright'],['six-of-wands','upright']]),
    expectations:['Cho phép kết luận thuận lợi có căn cứ về hợp tác, kỹ năng và ghi nhận.', 'Không áp cảnh báo của ca quá tải lên bối cảnh đã có hỗ trợ.', 'Không bảo đảm được nhận dự án hay bịa thêm sự kiện.'],
  },
  {
    id:'finance-reversed-relief',
    request:request('Tôi đã ngừng mua sắm theo hứng, đang ghi lại các khoản nợ và đã hỏi người nhà cách hỗ trợ. Tôi có thể bắt đầu thoát vòng lặp này chưa, hay vẫn cần chú ý điều gì?', 'finance','three', [['the-devil','reversed'],['eight-of-swords','reversed'],['five-of-pentacles','reversed']]),
    expectations:['Nhận ra dấu hiệu tháo gỡ phù hợp hành động đã cung cấp.', 'Không coi mọi lá ngược là xấu hoặc khẳng định đã hết nợ.', 'Nêu điều kiện phục hồi thực tế và vấn đề vẫn cần theo dõi.'],
  },
  {
    id:'love-same-card-different-context',
    request:request('Chúng tôi sống chung, tôi vẫn làm việc nhà đều đặn nhưng hai người ít trò chuyện. Tôi nên thay đổi điều gì để quan hệ bớt xa cách?', 'love','single', [['eight-of-pentacles','reversed']]),
    expectations:['Liên hệ sự máy móc với chăm sóc quan hệ và thiếu trò chuyện.', 'Không chép lời khuyên nâng tay nghề của ca công việc có cùng lá.', 'Không suy đoán người kia hết yêu hoặc có người khác.'],
  },
  {
    id:'general-unclear',
    request:request('Xem hành trình sắp tới của tôi.', 'general','single', [['the-moon','reversed']]),
    expectations:['Giới hạn góc nhìn tổng quan vì chưa có lĩnh vực hoặc hoàn cảnh cụ thể.', 'Không tự bịa người yêu, công ty, khoản nợ hoặc biến cố.', 'Giữ cả khả năng thông tin rõ hơn và khả năng tiếp tục né tránh.'],
  },
];
