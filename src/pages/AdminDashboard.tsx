import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { format, parseISO, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, isWithinInterval } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName: string;
  date: string;
  status: 'present' | 'late' | 'absent';
  timestamp: any;
}

interface Member {
  id: string;
  name: string;
  department: string;
  wage?: number;
}

export function AdminDashboard() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'month' | 'quarter'>('month');
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    const q = query(collection(db, 'attendance'), orderBy('date', 'desc'));
    const unsubscribeRecords = onSnapshot(q, (snapshot) => {
      const recordsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AttendanceRecord[];
      setRecords(recordsData);
      setLoading(false);
    });

    const unsubscribeMembers = onSnapshot(collection(db, 'members'), (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Member[];
      setMembers(membersData);
    });

    return () => {
      unsubscribeRecords();
      unsubscribeMembers();
    };
  }, []);

  const filteredRecords = useMemo(() => {
    let start, end;
    if (filterType === 'month') {
      start = startOfMonth(selectedDate);
      end = endOfMonth(selectedDate);
    } else {
      start = startOfQuarter(selectedDate);
      end = endOfQuarter(selectedDate);
    }

    return records.filter(record => {
      const recordDate = parseISO(record.date);
      return isWithinInterval(recordDate, { start, end });
    });
  }, [records, filterType, selectedDate]);

  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const present = filteredRecords.filter(r => r.status === 'present').length;
    const late = filteredRecords.filter(r => r.status === 'late').length;
    const absent = filteredRecords.filter(r => r.status === 'absent').length;

    return { total, present, late, absent };
  }, [filteredRecords]);

  const memberStats = useMemo(() => {
    const statsMap = new Map<string, { name: string, department: string, present: number, late: number, absent: number, total: number, wage: number, earnings: number }>();
    
    // Initialize with all members
    members.forEach(member => {
      statsMap.set(member.id, {
        name: member.name,
        department: member.department,
        present: 0,
        late: 0,
        absent: 0,
        total: 0,
        wage: member.wage || 0,
        earnings: 0
      });
    });

    // Aggregate records
    filteredRecords.forEach(record => {
      if (statsMap.has(record.memberId)) {
        const memberStat = statsMap.get(record.memberId)!;
        memberStat[record.status]++;
        memberStat.total++;
        if (record.status === 'present' || record.status === 'late') {
          memberStat.earnings += memberStat.wage;
        }
      } else {
        // Fallback for records where member might have been deleted
        statsMap.set(record.memberId, {
          name: record.memberName || 'Unknown',
          department: 'Unknown',
          present: record.status === 'present' ? 1 : 0,
          late: record.status === 'late' ? 1 : 0,
          absent: record.status === 'absent' ? 1 : 0,
          total: 1,
          wage: 0,
          earnings: 0
        });
      }
    });

    return Array.from(statsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredRecords, members]);

  const pieData = [
    { name: 'Có mặt', value: stats.present, color: '#4F46E5' },
    { name: 'Đi muộn', value: stats.late, color: '#EAB308' },
    { name: 'Vắng mặt', value: stats.absent, color: '#DC2626' },
  ];

  const barData = useMemo(() => {
    const dataMap = new Map();
    filteredRecords.forEach(record => {
      if (!dataMap.has(record.date)) {
        dataMap.set(record.date, { date: record.date, present: 0, late: 0, absent: 0 });
      }
      dataMap.get(record.date)[record.status]++;
    });
    return Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRecords]);

  const handlePrev = () => {
    const newDate = new Date(selectedDate);
    if (filterType === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() - 3);
    }
    setSelectedDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(selectedDate);
    if (filterType === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 3);
    }
    setSelectedDate(newDate);
  };

  if (loading) {
    return <div className="text-center py-12">Đang tải bảng điều khiển...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bảng điều khiển</h1>
          <p className="mt-2 text-sm text-gray-700">Tổng quan về thống kê và báo cáo điểm danh.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <select
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'month' | 'quarter')}
          >
            <option value="month">Theo Tháng</option>
            <option value="quarter">Theo Quý</option>
          </select>
          <div className="flex items-center space-x-2 bg-white border border-gray-300 rounded-md px-2">
            <button onClick={handlePrev} className="p-1 hover:bg-gray-100 rounded">&lt;</button>
            <span className="text-sm font-medium px-2 min-w-[120px] text-center">
              {filterType === 'month' 
                ? format(selectedDate, 'MMMM yyyy')
                : `Q${Math.floor(selectedDate.getMonth() / 3) + 1} ${format(selectedDate, 'yyyy')}`
              }
            </span>
            <button onClick={handleNext} className="p-1 hover:bg-gray-100 rounded">&gt;</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Tổng lượt</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.total}</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Có mặt</dt>
            <dd className="mt-1 text-3xl font-semibold text-indigo-600">{stats.present}</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Đi muộn</dt>
            <dd className="mt-1 text-3xl font-semibold text-yellow-500">{stats.late}</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Vắng mặt</dt>
            <dd className="mt-1 text-3xl font-semibold text-red-600">{stats.absent}</dd>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white shadow rounded-lg p-6 lg:col-span-2">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Biểu đồ Điểm danh</h3>
          <div className="h-80">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(val) => format(parseISO(val), 'MMM dd')} />
                  <YAxis />
                  <Tooltip labelFormatter={(val) => format(parseISO(val as string), 'MMMM dd, yyyy')} />
                  <Legend />
                  <Bar dataKey="present" stackId="a" fill="#4F46E5" name="Có mặt" />
                  <Bar dataKey="late" stackId="a" fill="#EAB308" name="Đi muộn" />
                  <Bar dataKey="absent" stackId="a" fill="#DC2626" name="Vắng mặt" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">Không có dữ liệu cho khoảng thời gian này</div>
            )}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Tỉ lệ</h3>
          <div className="h-80">
            {stats.total > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">Không có dữ liệu</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Thống kê Thành viên</h3>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Họ và tên</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Có mặt</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Đi muộn</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Vắng mặt</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tiền công</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {memberStats.map((stat, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{stat.name}</div>
                      <div className="text-xs text-gray-500">{stat.department}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 font-semibold text-indigo-600">
                      {stat.present}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 font-semibold text-yellow-500">
                      {stat.late}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 font-semibold text-red-600">
                      {stat.absent}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 font-bold text-green-600">
                      {stat.earnings > 0 ? stat.earnings.toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
                {memberStats.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      Không tìm thấy thành viên nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Lịch sử Gần đây</h3>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Họ và tên</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRecords.slice(0, 20).map((record) => (
                  <tr key={record.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(parseISO(record.date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {record.memberName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                        ${record.status === 'present' ? 'bg-indigo-100 text-indigo-800' : 
                          record.status === 'late' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'}`}
                      >
                        {record.status === 'present' ? 'Có mặt' : record.status === 'late' ? 'Đi muộn' : 'Vắng mặt'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                      Không có dữ liệu điểm danh trong khoảng thời gian này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
