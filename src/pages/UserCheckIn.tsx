import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { format } from 'date-fns';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface Member {
  id: string;
  name: string;
  department: string;
}

interface UserCheckInProps {
  user: User;
}

export function UserCheckIn({ user }: UserCheckInProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [status, setStatus] = useState('present');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [todayRecords, setTodayRecords] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'members'), (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Member[];
      setMembers(membersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchTodayRecords = async () => {
      const q = query(
        collection(db, 'attendance'),
        where('date', '==', selectedDate)
      );
      const querySnapshot = await getDocs(q);
      const records: Record<string, any> = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        records[data.memberId] = data;
      });
      setTodayRecords(records);
    };

    fetchTodayRecords();
  }, [submitting, selectedDate]); // Re-fetch when submitting changes (after successful check-in) or date changes

  const handleToggleMember = (memberId: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSelectAll = (filtered: Member[]) => {
    const unrecordedFiltered = filtered.filter(m => !todayRecords[m.id]);
    if (unrecordedFiltered.every(m => selectedMemberIds.includes(m.id))) {
      // Deselect all filtered
      setSelectedMemberIds(prev => prev.filter(id => !unrecordedFiltered.find(m => m.id === id)));
    } else {
      // Select all filtered
      const newIds = new Set([...selectedMemberIds, ...unrecordedFiltered.map(m => m.id)]);
      setSelectedMemberIds(Array.from(newIds));
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMemberIds.length === 0) {
      setMessage({ type: 'error', text: 'Vui lòng chọn ít nhất một thành viên.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      let successCount = 0;

      for (const memberId of selectedMemberIds) {
        // Double check if already checked in
        if (todayRecords[memberId]) continue;

        const selectedMember = members.find(m => m.id === memberId);
        if (!selectedMember) continue;

        await addDoc(collection(db, 'attendance'), {
          memberId: memberId,
          memberName: selectedMember.name,
          date: selectedDate,
          timestamp: serverTimestamp(),
          status: status
        });
        successCount++;
      }

      setMessage({ type: 'success', text: `Đã điểm danh thành công cho ${successCount} thành viên!` });
      setSelectedMemberIds([]); // Clear selection after success
    } catch (error: any) {
      console.error("Error checking in:", error);
      setMessage({ type: 'error', text: `Điểm danh thất bại: ${error.message}` });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Đang tải...</div>;
  }

  const filteredMembers = members.filter(m => 
    (m.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.department || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const unrecordedFiltered = filteredMembers.filter(m => !todayRecords[m.id]);
  const allFilteredSelected = unrecordedFiltered.length > 0 && unrecordedFiltered.every(m => selectedMemberIds.includes(m.id));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white shadow sm:rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Điểm danh
          </h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>Chọn ngày, thành viên và trạng thái hiện tại để ghi nhận điểm danh.</p>
          </div>
          
          <form className="mt-6 space-y-6" onSubmit={handleCheckIn}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ngày điểm danh
              </label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm mb-4"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chọn Thành viên
              </label>
              
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên hoặc phòng ban..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="border border-gray-200 rounded-md overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={allFilteredSelected}
                      onChange={() => handleSelectAll(filteredMembers)}
                      disabled={unrecordedFiltered.length === 0}
                    />
                    <span className="text-sm font-medium text-gray-700">Chọn tất cả (Đã lọc)</span>
                  </label>
                  <span className="text-xs text-gray-500">{selectedMemberIds.length} đã chọn</span>
                </div>
                
                <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                  {filteredMembers.length === 0 ? (
                    <div className="text-center py-4 text-sm text-gray-500">Không tìm thấy thành viên nào</div>
                  ) : (
                    filteredMembers.map((member) => {
                      const isRecorded = !!todayRecords[member.id];
                      const recordStatus = isRecorded ? todayRecords[member.id].status : null;
                      
                      return (
                        <label 
                          key={member.id} 
                          className={`flex items-center justify-between p-3 rounded-md border ${
                            isRecorded ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed' : 
                            selectedMemberIds.includes(member.id) ? 'bg-indigo-50 border-indigo-200 cursor-pointer' : 'bg-white border-gray-200 cursor-pointer hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                              checked={selectedMemberIds.includes(member.id)}
                              onChange={() => handleToggleMember(member.id)}
                              disabled={isRecorded}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{member.name}</p>
                              <p className="text-xs text-gray-500">{member.department}</p>
                            </div>
                          </div>
                          {isRecorded && (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                              ${recordStatus === 'present' ? 'bg-indigo-100 text-indigo-800' : 
                                recordStatus === 'late' ? 'bg-yellow-100 text-yellow-800' : 
                                'bg-red-100 text-red-800'}`}
                            >
                              {recordStatus === 'present' ? 'Có mặt' : recordStatus === 'late' ? 'Đi muộn' : 'Vắng mặt'}
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trạng thái Điểm danh
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className={`
                  border rounded-md py-3 px-3 flex items-center justify-center text-sm font-medium uppercase sm:flex-1 cursor-pointer focus:outline-none
                  ${status === 'present' ? 'bg-indigo-600 border-transparent text-white hover:bg-indigo-700' : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50'}
                `}>
                  <input type="radio" name="status" value="present" className="sr-only" checked={status === 'present'} onChange={() => setStatus('present')} />
                  Có mặt
                </label>
                <label className={`
                  border rounded-md py-3 px-3 flex items-center justify-center text-sm font-medium uppercase sm:flex-1 cursor-pointer focus:outline-none
                  ${status === 'late' ? 'bg-yellow-500 border-transparent text-white hover:bg-yellow-600' : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50'}
                `}>
                  <input type="radio" name="status" value="late" className="sr-only" checked={status === 'late'} onChange={() => setStatus('late')} />
                  Đi muộn
                </label>
                <label className={`
                  border rounded-md py-3 px-3 flex items-center justify-center text-sm font-medium uppercase sm:flex-1 cursor-pointer focus:outline-none
                  ${status === 'absent' ? 'bg-red-600 border-transparent text-white hover:bg-red-700' : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50'}
                `}>
                  <input type="radio" name="status" value="absent" className="sr-only" checked={status === 'absent'} onChange={() => setStatus('absent')} />
                  Vắng mặt
                </label>
              </div>
            </div>

            {message && (
              <div className={`rounded-md p-4 ${message.type === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    {message.type === 'success' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-400" aria-hidden="true" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                    )}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                      {message.text}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting || selectedMemberIds.length === 0}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                  ${submitting || selectedMemberIds.length === 0 ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}
                `}
              >
                {submitting ? 'Đang lưu...' : `Lưu Điểm danh cho ${selectedMemberIds.length} thành viên`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
